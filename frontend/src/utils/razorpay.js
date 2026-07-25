let razorpayScriptPromise;

function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout can only run in the browser."));
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () =>
        reject(new Error("Unable to load Razorpay Checkout. Check your internet connection and try again."));
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}

export async function startRazorpayCheckout({
  token,
  cryptoType,
  cryptoName,
  amount,
  price,
  customer,
  preferredMethod = "card",
}) {
  if (!token) {
    throw new Error("Please login before making a payment.");
  }

  const Razorpay = await loadRazorpayScript();

  const orderResponse = await fetch("/api/payments/razorpay/order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      cryptoType,
      cryptoName,
      amount,
      price,
    }),
  });

  const orderData = await orderResponse.json();
  if (!orderResponse.ok) {
    throw new Error(orderData.error || "Unable to create Razorpay order.");
  }

  const isTestMode = String(orderData.keyId || "").startsWith("rzp_test_");

  const display = isTestMode
    ? {
        hide: [
          { method: "upi" },
          { method: "netbanking" },
          { method: "wallet" },
          { method: "emi" },
        ],
        sequence: ["block.preferred"],
        preferences: {
          show_default_blocks: false,
        },
        blocks: {
          preferred: {
            name: "Preferred payment methods",
            instruments:
              preferredMethod === "paylater"
                ? [{ method: "paylater" }, { method: "card" }]
                : [{ method: "card" }, { method: "paylater" }],
          },
        },
      }
    : undefined;

  return new Promise((resolve, reject) => {
    const razorpay = new Razorpay({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: orderData.companyName,
      description: `Buy ${orderData.quantity} ${orderData.cryptoType} on Cryptomarket`,
      order_id: orderData.orderId,
      theme: { color: orderData.themeColor },
      prefill: {
        name: customer?.username || "",
        email: customer?.email || "",
      },
      method: preferredMethod,
      display,
      notes: {
        cryptoType: orderData.cryptoType,
        cryptoName: orderData.cryptoName,
        quantity: String(orderData.quantity),
        totalValueUsd: String(orderData.totalValueUsd),
        totalValueInr: String(orderData.totalValueInr),
      },
      retry: {
        enabled: false,
      },
      modal: {
        ondismiss: () => reject(new Error("Payment was cancelled before completion.")),
      },
      handler: async (response) => {
        try {
          const verifyResponse = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              ...response,
              cryptoType: orderData.cryptoType,
              cryptoName: orderData.cryptoName,
              amount: orderData.quantity,
              price: orderData.unitPriceUsd,
            }),
          });

          const verifyData = await verifyResponse.json();
          if (!verifyResponse.ok) {
            throw new Error(verifyData.error || "Unable to verify the payment.");
          }

          resolve({
            success: true,
            ...verifyData,
            order: orderData,
          });
        } catch (error) {
          reject(error);
        }
      },
    });

    razorpay.on("payment.failed", (event) => {
      const failureReason =
        event?.error?.description ||
        event?.error?.reason ||
        event?.error?.step ||
        "Razorpay payment failed.";
      console.error("Razorpay payment failed", event?.error || event);
      reject(new Error(failureReason));
    });

    razorpay.open();
  });
}

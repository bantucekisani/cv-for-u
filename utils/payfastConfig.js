const crypto = require("crypto");

function normalize(value) {
  return String(value ?? "").trim();
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(normalize(value).toLowerCase());
}

function isLiveMode() {
  const mode = normalize(process.env.PAYFAST_MODE).toLowerCase();

  if (mode === "live") {
    return true;
  }

  if (mode === "sandbox" || mode === "test") {
    return false;
  }

  const sandbox = normalize(process.env.PAYFAST_SANDBOX);
  if (sandbox) {
    return !isTruthy(sandbox);
  }

  // Default to sandbox unless live mode is explicitly enabled.
  return false;
}

function getMerchantCredentials() {
  return {
    merchantId: normalize(process.env.PAYFAST_MERCHANT_ID),
    merchantKey: normalize(process.env.PAYFAST_MERCHANT_KEY),
    passphrase: normalize(process.env.PAYFAST_PASSPHRASE)
  };
}

function assertConfigured() {
  const { merchantId, merchantKey } = getMerchantCredentials();

  if (!merchantId || !merchantKey) {
    throw new Error("PayFast merchant credentials are not configured");
  }
}

function getPayfastHost() {
  return isLiveMode()
    ? "https://www.payfast.co.za"
    : "https://sandbox.payfast.co.za";
}

function getProcessUrl() {
  return `${getPayfastHost()}/eng/process`;
}

function getValidationUrl() {
  return `${getPayfastHost()}/eng/query/validate`;
}

function uppercaseEncodedHex(value) {
  return value.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
}

function encodeValue(value) {
  const encoded = encodeURIComponent(String(value ?? "").trim())
    .replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");

  return uppercaseEncodedHex(encoded);
}

function buildParameterString(data, passphrase) {
  const parts = Object.entries(data)
    .filter(([key, value]) => key !== "signature" && normalize(value))
    .map(([key, value]) => `${key}=${encodeValue(value)}`);

  if (normalize(passphrase)) {
    parts.push(`passphrase=${encodeValue(passphrase)}`);
  }

  return parts.join("&");
}

function createSignature(data) {
  const { passphrase } = getMerchantCredentials();
  const paramString = buildParameterString(data, passphrase);

  return crypto
    .createHash("md5")
    .update(paramString, "utf8")
    .digest("hex");
}

const CHECKOUT_FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "m_payment_id",
  "amount",
  "item_name"
];

function buildPaymentData(data) {
  const { merchantId, merchantKey } = getMerchantCredentials();
  const values = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: data.returnUrl,
    cancel_url: data.cancelUrl,
    notify_url: data.notifyUrl,
    name_first: data.firstName,
    name_last: data.lastName,
    email_address: data.emailAddress,
    m_payment_id: data.paymentId,
    amount: data.amount,
    item_name: data.itemName
  };

  return CHECKOUT_FIELD_ORDER.reduce((ordered, key) => {
    ordered[key] = values[key];
    return ordered;
  }, {});
}

function buildRedirectQuery(data) {
  const signature = createSignature(data);
  const base = buildParameterString(data);
  return `${base}&signature=${encodeValue(signature)}`;
}

module.exports = {
  assertConfigured,
  buildPaymentData,
  buildRedirectQuery,
  getProcessUrl,
  getValidationUrl,
  isLiveMode
};

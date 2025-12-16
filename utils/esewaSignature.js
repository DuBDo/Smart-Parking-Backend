const crypto = require("crypto");

module.exports.generateSignature = (
  {
    transaction_code,
    status,
    total_amount,
    transaction_uuid,
    product_code,
    signed_field_names,
  },
  secret,
  type
) => {
  if (type == "initiator") {
    const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;

    return crypto.createHmac("sha256", secret).update(message).digest("base64");
  }
  if (type == "tokenVerify") {
    const message = `transaction_code=${transaction_code},status=${status},total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code},signed_field_names=${signed_field_names}`;

    return crypto.createHmac("sha256", secret).update(message).digest("base64");
  }
};

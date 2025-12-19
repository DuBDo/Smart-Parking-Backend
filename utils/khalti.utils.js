import axios from "axios";

export const khaltiInitiate = async ({
  amount,
  purchaseOrderId,
  purchaseOrderName,
  customer,
}) => {
  try {
    const response = await axios.post(
      "https://dev.khalti.com/api/v2/epayment/initiate/",
      {
        return_url: `${process.env.BACKEND_BASE_URL}/api/V1/payment/khalti/success`,
        website_url: process.env.CLIENT_URL,
        amount, // in paisa
        purchase_order_id: purchaseOrderId,
        purchase_order_name: purchaseOrderName,
        customer_info: customer,
      },
      {
        headers: {
          Authorization: `key ${process.env.KHALTI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data; // contains payment_url & pidx
  } catch (error) {
    console.log(error);
  }
};

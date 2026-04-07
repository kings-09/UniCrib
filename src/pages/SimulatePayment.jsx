import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useState, useEffect } from "react";

export default function SimulatePayment() {
  const navigate = useNavigate();
  const [setLoading] = useState(false);
  const { bookingId } = useParams();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [propertyPrice, setPropertyPrice] = useState(0);
  const depositAmount = (propertyPrice * 0.2).toFixed(2);

  useEffect(() => {
    const fetchBookingDetails = async () => {
      const { data: booking, error } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("id", bookingId)
        .maybeSingle();

      if (!booking || error) return;

      const { data: property } = await supabase
        .from("properties")
        .select("price")
        .eq("id", booking.property_id)
        .maybeSingle();

      if (property) {
        setPropertyPrice(property.price);
      }
    };

    if (bookingId) {
      fetchBookingDetails();
    }
  }, [bookingId]);

  const handlePayment = async () => {
    setLoading(true);

    // Fetch booking
    const { data: booking, error } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking) return;

    if (error || !booking) {
      alert("Booking not found.");
      setLoading(false);
      return;
    }

    // 🚫 Prevent double payment
    if (booking.payment_status === "paid") {
      alert("This booking has already been paid.");
      setLoading(false);
      return;
    }

    // 🚫 Prevent payment if not approved
    if (booking.status !== "approved") {
      alert("This booking is not approved for payment.");
      setLoading(false);
      return;
    }

    //const propertyPrice = booking?.properties?.price || 0;
    const depositAmount = (propertyPrice * 0.2).toFixed(2);

    // ✅ Validate payment method
    if (!paymentMethod) {
      alert("Please select payment method");
      setLoading(false);
      return;
    }

    if (paymentMethod === "ecocash" && phoneNumber.length < 9) {
      alert("Enter valid EcoCash number");
      setLoading(false);
      return;
    }

    if (paymentMethod === "bank" && (!bankName || !accountNumber)) {
      alert("Enter complete bank details");
      setLoading(false);
      return;
    }

    // ✅ Update booking
    const { error: updateError } = await supabase
      .from("booking_requests")
      .update({
        payment_status: "paid",
        status: "confirmed",
        payment_method: paymentMethod,
        payment_reference: "SIM" + Date.now()
      })
      .eq("id", bookingId);

    if (updateError) {
      alert(updateError.message);
      setLoading(false);
      return;
    }

    alert(`Payment of $${depositAmount} Successful!`);
    navigate("/dashboard");
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Secure Payment</h2>

        <div style={styles.summaryBox}>
          <p><strong>Property Price:</strong> ${propertyPrice}</p>
          <p><strong>Deposit (20%):</strong> ${depositAmount}</p>
        </div>

        <label>Select Payment Method</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          style={styles.input}
        >
          <option value="">Choose Method</option>
          <option value="ecocash">EcoCash</option>
          <option value="onemoney">OneMoney</option>
          <option value="bank">Bank Transfer</option>
        </select>

        {paymentMethod === "ecocash" && (
          <>
            <input
              placeholder="EcoCash Number (e.g. 077XXXXXXX)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={styles.input}
            />
          </>
        )}

        {paymentMethod === "bank" && (
          <>
            <input
              placeholder="Bank Name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              style={styles.input}
            />
            <input
              placeholder="Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              style={styles.input}
            />
          </>
        )}

        <button
          onClick={handlePayment}
          disabled={!paymentMethod}
          style={styles.payBtn}
        >
          Confirm & Pay ${depositAmount}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f3f4f6"
  },
  card: {
    background: "white",
    padding: "40px",
    borderRadius: "12px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)"
  },
  payBtn: {
    marginTop: "20px",
    padding: "12px 20px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer"
  },
  summaryBox: {
    backgroundColor: "#f1f5f9",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "20px"
  },
  input: {
    padding: "10px",
    marginTop: "10px",
    marginBottom: "10px",
    borderRadius: "6px",
    border: "1px solid #ddd",
    width: "100%"
  },
};
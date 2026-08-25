import { inr, fmtDateTime, titleCase } from "../utils/format";

/**
 * 80mm thermal-receipt layout. Rendered inside a print modal; the element with
 * id="print-area" is the only thing the browser prints (see index.css), so the
 * cashier sees a preview and gets a clean, narrow slip on the receipt printer.
 */
export default function ThermalReceipt({ business, sale }) {
  const items = sale.items || [];
  const customer = sale.customer;
  const isInterState = sale.isInterState;
  const cgst = Number(sale.cgst || 0);
  const sgst = Number(sale.sgst || 0);
  const igst = Number(sale.igst || 0);

  return (
    <div id="print-area" className="receipt-paper">
      <div className="rec-center rec-bold rec-lg">{business?.name || "Business"}</div>
      {business?.address && <div className="rec-center rec-xs">{business.address}</div>}
      <div className="rec-center rec-xs">
        {[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ")}
      </div>
      {business?.phone && <div className="rec-center rec-xs">Ph: {business.phone}</div>}
      {business?.gstin && <div className="rec-center rec-xs">GSTIN: {business.gstin}</div>}
      <div className="rec-rule" />
      <div className="rec-row rec-xs">
        <span>Bill</span>
        <span>{sale.invoiceNo}</span>
      </div>
      <div className="rec-row rec-xs">
        <span>Date</span>
        <span>{fmtDateTime(sale.saleDate || sale.createdAt)}</span>
      </div>
      {customer && (
        <div className="rec-row rec-xs">
          <span>Cust</span>
          <span>{customer.name}{customer.phone ? ` (${customer.phone})` : ""}</span>
        </div>
      )}
      <div className="rec-rule" />

      <div className="rec-colhead rec-xs">
        <span className="rec-name">Item</span>
        <span>Qty</span>
        <span className="rec-amt">Amt</span>
      </div>
      {items.map((it, i) => (
        <div className="rec-line rec-xs" key={i}>
          <span className="rec-name">{it.productName}</span>
          <span>
            {Number(it.quantity)}×{inr(it.rate, { decimals: 2 }).replace("₹", "")}
          </span>
          <span className="rec-amt">{inr(it.lineTotal, { decimals: 2 })}</span>
        </div>
      ))}
      <div className="rec-rule" />

      <div className="rec-row">
        <span>Subtotal</span>
        <span>{inr(sale.subtotal)}</span>
      </div>
      {Number(sale.discount) > 0 && (
        <div className="rec-row">
          <span>Discount</span>
          <span>-{inr(sale.discount)}</span>
        </div>
      )}
      {!isInterState ? (
        <>
          <div className="rec-row">
            <span>CGST</span>
            <span>{inr(cgst)}</span>
          </div>
          <div className="rec-row">
            <span>SGST</span>
            <span>{inr(sgst)}</span>
          </div>
        </>
      ) : (
        <div className="rec-row">
          <span>IGST</span>
          <span>{inr(igst)}</span>
        </div>
      )}
      <div className="rec-rule" />
      <div className="rec-row rec-bold rec-lg">
        <span>TOTAL</span>
        <span>{inr(sale.grandTotal)}</span>
      </div>
      <div className="rec-row">
        <span>Paid ({titleCase(sale.paymentMethod).replace(" ", "")})</span>
        <span>{inr(sale.paidAmount)}</span>
      </div>
      {Number(sale.dueAmount) > 0 && (
        <div className="rec-row rec-danger">
          <span>Balance Due</span>
          <span>{inr(sale.dueAmount)}</span>
        </div>
      )}
      <div className="rec-rule" />
      {business?.upiId && (
        <div className="rec-center rec-xs">Pay UPI: {business.upiId}</div>
      )}
      <div className="rec-center rec-xs rec-mt">Thank you for shopping!</div>
      <div className="rec-center rec-xs">***</div>
    </div>
  );
}

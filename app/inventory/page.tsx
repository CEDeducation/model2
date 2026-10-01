import InventoryWorkspace from "@/components/InventoryWorkspace"

export default function InventoryPage() {
  return (
    <div className="fullPage">
      <div className="pageHeading compact"><div><div className="sectionEyebrow">LAB OPERATIONS</div><h1>Inventory</h1><p>Track materials, lots, locations, quantities, expiry dates, and low-stock thresholds.</p></div></div>
      <InventoryWorkspace/>
    </div>
  )
}

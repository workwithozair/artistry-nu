"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"



export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id: tournamentId } = useParams()
  const submissionId = searchParams.get("submissionId")
  const receiptRef = useRef<HTMLDivElement>(null)

  const [submission, setSubmission] = useState<any>(null)
  const [tournament, setTournament] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (!tournamentId || !submissionId) {
        router.push("/dashboard")
        return
      }

      const submissionRef = doc(db, "submissions", submissionId)
      const submissionSnap = await getDoc(submissionRef)

      if (!submissionSnap.exists()) {
        router.push("/dashboard")
        return
      }

      const data = submissionSnap.data()
      if (data.tournament_id !== tournamentId || data.payment_status !== "paid") {
        router.push("/dashboard")
        return
      }

      const tournamentRef = doc(db, "tournaments", tournamentId as string)
      const tournamentSnap = await getDoc(tournamentRef)
      setSubmission(data)
      setTournament(tournamentSnap.exists() ? tournamentSnap.data() : null)
      setLoading(false)
    }

    fetchData()
  }, [tournamentId, submissionId, router])

//   const handleDownloadReceipt = () => {
//     if (!receiptRef.current) return
  
//     const htmlContent = `
//       <html>
//         <head>
//           <title>Payment Receipt</title>
//           <style>
//             body { font-family: sans-serif; padding: 20px; }
//             h2 { color: green; }
//             .line { margin-bottom: 8px; }
//           </style>
//         </head>
//         <body>
//           ${receiptRef.current.innerHTML}
//         </body>
//       </html>
//     `
  
//     const blob = new Blob([htmlContent], { type: "text/html" })
//     const url = URL.createObjectURL(blob)
  
//     const link = document.createElement("a")
//     link.href = url
//     link.download = "receipt.html"
//     document.body.appendChild(link)
//     link.click()
//     document.body.removeChild(link)
//     URL.revokeObjectURL(url)
//   }
  
const handleDownloadReceipt = async () => {
    if (!receiptRef.current) return
  
    const canvas = await html2canvas(receiptRef.current)
    const imgData = canvas.toDataURL("image/png")
  
    const pdf = new jsPDF()
    const imgProps = pdf.getImageProperties(imgData)
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
  
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
    pdf.save("receipt.pdf")
  }


//   const handleDownloadReceipt = () => {
//     if (!receiptRef.current) return

//     const printContent = receiptRef.current.innerHTML
//     const printWindow = window.open("", "", "height=600,width=800")
//     if (!printWindow) return

//     printWindow.document.write("<html><head><title>Payment Receipt</title>")
//     printWindow.document.write(
//       `<style>
//         body { font-family: sans-serif; padding: 20px; }
//         h2 { color: green; }
//         .line { margin-bottom: 8px; }
//       </style>`
//     )
//     printWindow.document.write("</head><body>")
//     printWindow.document.write(printContent)
//     printWindow.document.write("</body></html>")
//     printWindow.document.close()
//     printWindow.print()
//   }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow">
      <div ref={receiptRef}>
        <h2 className="text-2xl font-bold mb-4 text-green-600">🎉 Payment Successful!</h2>

        <div className="line"><strong>Tournament:</strong> {tournament?.title ?? "N/A"}</div>
        <div className="line"><strong>Submission Title:</strong> {submission.title}</div>
        <div className="line"><strong>Applicant:</strong> {submission.applicant_name}</div>
        <div className="line"><strong>Phone:</strong> {submission.phone_number}</div>
        <div className="line"><strong>Amount Paid:</strong> ₹{(submission.amount_paid ?? 0) / 100}</div>
        <div className="line">
          <strong>Date:</strong>{" "}
          {submission.payment_date
            ? format(new Date(submission.payment_date.seconds * 1000), "PPPppp")
            : "N/A"}
        </div>
        <div className="line"><strong>Razorpay Payment ID:</strong> {submission.razorpay_payment_id}</div>
        <div className="line"><strong>Razorpay Order ID:</strong> {submission.razorpay_order_id}</div>
      </div>

      <div className="mt-6">
        <Button onClick={handleDownloadReceipt}>Download Receipt</Button>
      </div>
    </div>
  )
}

"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getUserPayments(userId: string) {
  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("payments")
      .select(`
        *,
        tournaments:tournament_id (
          id,
          title,
          entry_fee
        )
      `)
      .eq("user_id", userId)
      .order("payment_date", { ascending: false })

    if (error) {
      console.error("Error fetching user payments:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Error in getUserPayments:", error)
    return []
  }
}

// Add the missing export as an alias to getUserPayments
export const getPaymentsByUserId = getUserPayments

export async function processPayment(formData: FormData) {
  try {
    const tournamentId = formData.get("tournamentId") as string
    const userId = formData.get("userId") as string
    const paymentMethod = formData.get("paymentMethod") as string

    if (!tournamentId || !userId || !paymentMethod) {
      return {
        success: false,
        message: "Missing required fields",
      }
    }

    const supabase = createServerClient()

    // Get tournament details to get the entry fee
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("entry_fee")
      .eq("id", tournamentId)
      .single()

    if (tournamentError || !tournament) {
      console.error("Error fetching tournament:", tournamentError)
      return {
        success: false,
        message: "Error fetching tournament details",
      }
    }

    // Check if payment already exists
    const { data: existingPayment, error: checkError } = await supabase
      .from("payments")
      .select("id")
      .eq("user_id", userId)
      .eq("tournament_id", tournamentId)
      .eq("status", "completed")
      .maybeSingle()

    if (checkError) {
      console.error("Error checking payment:", checkError)
      return {
        success: false,
        message: "Error checking payment status",
      }
    }

    if (existingPayment) {
      return {
        success: false,
        message: "Payment already processed for this tournament",
      }
    }

    // In a real application, you would integrate with a payment gateway here
    // For now, we'll just simulate a successful payment

    // Create payment record
    const { error: paymentError } = await supabase.from("payments").insert({
      user_id: userId,
      tournament_id: tournamentId,
      amount: tournament.entry_fee,
      status: "completed",
      payment_date: new Date().toISOString(),
      payment_method: paymentMethod,
      transaction_id: "txn_" + Math.random().toString(36).substring(2, 12),
    })

    if (paymentError) {
      console.error("Error creating payment:", paymentError)
      return {
        success: false,
        message: "Error processing payment",
      }
    }

    revalidatePath("/dashboard/payments")

    return {
      success: true,
      message: "Payment processed successfully",
    }
  } catch (error) {
    console.error("Error in processPayment:", error)
    return {
      success: false,
      message: "An unexpected error occurred",
    }
  }
}

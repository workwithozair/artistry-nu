"use server"

import { db } from "@/lib/firebase/server"
import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore"

export async function getAllTournaments() {
  try {
    const snapshot = await db.collection("tournaments").orderBy("registration_start", "desc").get()
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error("Error in getAllTournaments:", error)
    return []
  }
}

export const getTournaments = getAllTournaments

export async function getTournamentById(id: string) {
  try {
    const doc = await db.collection("tournaments").doc(id).get()
    return doc.exists ? { id: doc.id, ...doc.data() } : null
  } catch (error) {
    console.error("Error in getTournamentById:", error)
    return null
  }
}

export async function getAllTournamentForUser() {
  try {
    const snapshot = await db.collection("tournaments").where("status", "==", "open").orderBy("registration_start", "desc").get()
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error("Error in getTournamentById:", error)
    return null
  }
}

export async function getUserSubmissionForTournament(userId: string, tournamentId: string) {
  try {
    const snapshot = await db
      .collection("submissions")
      .where("user_id", "==", userId)
      .where("tournament_id", "==", tournamentId)
      .limit(1)
      .get()

    if (snapshot.empty) return null

    const doc = snapshot.docs[0]
    return {
      id: doc.id,
      ...doc.data(),
    }
  } catch (error) {
    console.error("Error in getUserSubmissionForTournament:", error)
    return null
  }
}

export async function getUserTournaments(userId: string) {
  try {
    const submissionsSnap = await db
      .collection("submissions")
      .where("user_id", "==", userId)
      .get()

    const tournamentIds = Array.from(new Set(submissionsSnap.docs.map(doc => doc.data().tournament_id)))

    if (tournamentIds.length === 0) return []

    const tournaments : any[] = await Promise.all(
      tournamentIds.map(async id => {
        const doc = await db.collection("tournaments").doc(id).get()
        return doc.exists ? { id: doc.id, ...doc.data() } : null
      })
    )

    return tournaments.filter(Boolean).sort((a, b) => {
      return (b?.registration_start?.toMillis?.() || 0) - (a?.registration_start?.toMillis?.() || 0)
    })
  } catch (error) {
    console.error("Error in getUserTournaments:", error)
    return []
  }
}

export async function registerForTournament(formData: FormData) {
  try {
    const tournamentId = formData.get("tournamentId") as string
    const userId = formData.get("userId") as string

    if (!tournamentId || !userId) {
      return { success: false, message: "Missing required fields" }
    }

    const existingSnap = await db
      .collection("submissions")
      .where("user_id", "==", userId)
      .where("tournament_id", "==", tournamentId)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      return {
        success: false,
        message: "You are already registered for this tournament",
      }
    }

    await db.collection("submissions").add({
      user_id: userId,
      tournament_id: tournamentId,
      status: "draft",
      title: "Draft Submission",
      description: "",
      created_at: Timestamp.now(),
    })

    revalidatePath("/dashboard/tournaments")

    return {
      success: true,
      message: "Successfully registered for tournament",
    }
  } catch (error) {
    console.error("Error in registerForTournament:", error)
    return {
      success: false,
      message: "An unexpected error occurred",
    }
  }
}

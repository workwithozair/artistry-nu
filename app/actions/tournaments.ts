"use server"

import { db } from "@/lib/firebase/server"
import { revalidatePath } from "next/cache"
import { Timestamp } from "firebase-admin/firestore"
import { format } from "date-fns"
import { storage } from "@/lib/firebase/server"

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
    if (!doc.exists) return null
    
    const data = doc.data() as Record<string, any>
    
    // Convert Firestore Timestamps to ISO strings
    const serializedData = {
      id: doc.id,
      ...data,
      registration_start: data.registration_start?.toDate?.()?.toISOString() || null,
      registration_end: data.registration_end?.toDate?.()?.toISOString() || null,
      start_date: data.start_date?.toDate?.()?.toISOString() || null,
      end_date: data.end_date?.toDate?.()?.toISOString() || null,
      created_at: data.created_at?.toDate?.()?.toISOString() || null,
      updated_at: data.updated_at?.toDate?.()?.toISOString() || null,
    }

    return serializedData
  } catch (error) {
    console.error("Error in getTournamentById:", error)
    return null
  }
}

export async function fetchTournamentById(tournamentId: string) {
  try {
    const docRef = db.collection("tournaments").doc(tournamentId)
    const docSnap = await docRef.get()

    if (!docSnap.exists) return null
    const data = docSnap.data()
    return JSON.parse(JSON.stringify(data))
  } catch (error) {
    console.error("Failed to fetch tournament:", error)
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
    const data = doc.data()
    
    // Convert Firestore Timestamp to ISO string
    const serializedData = {
      id: doc.id,
      ...data,
      created_at: data.created_at?.toDate?.()?.toISOString() || null,
      updated_at: data.updated_at?.toDate?.()?.toISOString() || null,
    }

    return serializedData
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



export async function createTournament(formData: FormData) {
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const category = formData.get('category') as string;
  const registrationStartDate = formData.get('registrationStartDate') as string;
  const registrationEndDate = formData.get('registrationEndDate') as string;
  const submissionEndDate = formData.get('submissionEndDate') as string;
  const entryFee = parseFloat(formData.get('entryFee') as string);
  const files = formData.getAll('files') as File[];

  if (!title || !description || !category || !registrationStartDate || !registrationEndDate || !submissionEndDate || !entryFee || files.length === 0) {
    throw new Error('Missing required fields');
  }

  // Create Firestore document for tournament
  const tournamentRef = await db.collection('tournaments').add({
    title,
    description,
    category,
    registration_start: format(new Date(registrationStartDate), 'yyyy-MM-dd'),
    registration_end: format(new Date(registrationEndDate), 'yyyy-MM-dd'),
    submission_deadline: format(new Date(submissionEndDate), 'yyyy-MM-dd'),
    entry_fee: entryFee,
    created_at: new Date(),
    updated_at: new Date(),
    status: "coming_soon",
  });

  const tournamentId = tournamentRef.id;
  const bucket = storage.bucket();
  const bannerUrls: string[] = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filePath = `tournaments/${tournamentId}/${file.name}`;
    const fileRef = bucket.file(filePath);

    await fileRef.save(buffer, {
      metadata: { contentType: file.type },
    });

    await fileRef.makePublic();

    const [downloadUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-09-2491',
    });

    bannerUrls.push(downloadUrl);
  }

  await tournamentRef.update({
    banner_images: bannerUrls,
    image_url: bannerUrls[0],
  });

  return { tournamentId, bannerUrls };
}


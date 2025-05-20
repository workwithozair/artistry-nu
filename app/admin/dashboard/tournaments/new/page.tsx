"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { createBrowserClient } from "@/lib/supabase/client"

export default function NewTournamentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createBrowserClient()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const category = formData.get("category") as string
    const registrationStartDate = formData.get("registrationStartDate") as string
    const registrationEndDate = formData.get("registrationEndDate") as string
    const submissionEndDate = formData.get("submissionEndDate") as string
    const entryFee = Number.parseFloat(formData.get("entryFee") as string)

    try {
      const { data, error } = await supabase
        .from("tournaments")
        .insert({
          title,
          description,
          category,
          registration_start_date: registrationStartDate,
          registration_end_date: registrationEndDate,
          submission_end_date: submissionEndDate,
          entry_fee: entryFee,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()

      if (error) {
        throw error
      }

      toast({
        title: "Success",
        description: "Tournament created successfully",
      })

      router.push("/admin/tournaments")
    } catch (error) {
      console.error("Error creating tournament:", error)
      toast({
        title: "Error",
        description: "Failed to create tournament",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Create New Tournament</h2>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Tournament Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" placeholder="Tournament title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" placeholder="Tournament description" rows={4} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select name="category" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital-art">Digital Art</SelectItem>
                  <SelectItem value="photography">Photography</SelectItem>
                  <SelectItem value="graphic-design">Graphic Design</SelectItem>
                  <SelectItem value="illustration">Illustration</SelectItem>
                  <SelectItem value="3d-modeling">3D Modeling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registrationStartDate">Registration Start Date</Label>
                <Input id="registrationStartDate" name="registrationStartDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationEndDate">Registration End Date</Label>
                <Input id="registrationEndDate" name="registrationEndDate" type="date" required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="submissionEndDate">Submission End Date</Label>
                <Input id="submissionEndDate" name="submissionEndDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entryFee">Entry Fee (₹)</Label>
                <Input id="entryFee" name="entryFee" type="number" min="0" step="0.01" defaultValue="25.00" required />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Tournament"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

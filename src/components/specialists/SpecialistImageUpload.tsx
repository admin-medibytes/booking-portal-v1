"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowLeftIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
  UserIcon,
} from "lucide-react"

import { useFileUpload } from "@/hooks/use-file-upload"
import { Button } from "@/components/ui/button"
import { Cropper } from "@/components/ui/cropper"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Define type for pixel crop area
type Area = { x: number; y: number; width: number; height: number }

// Helper function to create a cropped image blob
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", (error) => reject(error))
    image.setAttribute("crossOrigin", "anonymous") // Needed for canvas Tainted check
    image.src = url
  })

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth: number = pixelCrop.width, // Optional: specify output size
  outputHeight: number = pixelCrop.height
): Promise<Blob | null> {
  try {
    const image = await createImage(imageSrc)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return null
    }

    // Set canvas size to desired output size
    canvas.width = outputWidth
    canvas.height = outputHeight

    // Draw the cropped image onto the canvas
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      outputWidth, // Draw onto the output size
      outputHeight
    )

    // Convert canvas to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, "image/jpeg") // Specify format and quality if needed
    })
  } catch (error) {
    console.error("Error in getCroppedImg:", error)
    return null
  }
}

interface SpecialistImageUploadProps {
  currentImageUrl?: string | null
  userName?: string
  onImageChange: (imageBlob: Blob | null) => Promise<void>
  isUploading?: boolean
}

export default function SpecialistImageUpload({
  currentImageUrl,
  userName = "",
  onImageChange,
  isUploading = false,
}: SpecialistImageUploadProps) {
  const [
    { files },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
    },
  ] = useFileUpload({
    accept: "image/*",
  })

  const previewUrl = files[0]?.preview || null
  const fileId = files[0]?.id

  const [finalImageUrl, setFinalImageUrl] = useState<string | null>(currentImageUrl || null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Ref to track the previous file ID to detect new uploads
  const previousFileIdRef = useRef<string | undefined | null>(null)

  // State to store the desired crop area in pixels
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  // State for zoom level
  const [zoom, setZoom] = useState(1)

  // Callback for Cropper to provide crop data - Wrap with useCallback
  const handleCropChange = useCallback((pixels: Area | null) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleApply = async () => {
    // Check if we have the necessary data
    if (!previewUrl || !fileId || !croppedAreaPixels) {
      console.error("Missing data for apply:", {
        previewUrl,
        fileId,
        croppedAreaPixels,
      })
      // Remove file if apply is clicked without crop data?
      if (fileId) {
        removeFile(fileId)
        setCroppedAreaPixels(null)
      }
      return
    }

    try {
      // 1. Get the cropped image blob using the helper
      const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels, 200, 200)

      if (!croppedBlob) {
        throw new Error("Failed to generate cropped image blob.")
      }

      // 2. Create a NEW object URL from the cropped blob
      const newFinalUrl = URL.createObjectURL(croppedBlob)

      // 3. Revoke the OLD finalImageUrl if it exists and it's a blob URL
      if (finalImageUrl && finalImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(finalImageUrl)
      }

      // 4. Set the final avatar state to the NEW URL
      setFinalImageUrl(newFinalUrl)

      // 5. Call the parent callback with the cropped blob
      await onImageChange(croppedBlob)

      // 6. Close the dialog (don't remove the file yet)
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error during apply:", error)
      // Close the dialog even if cropping fails
      setIsDialogOpen(false)
    }
  }

  const handleRemoveFinalImage = async () => {
    if (finalImageUrl && finalImageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(finalImageUrl)
    }
    setFinalImageUrl(null)
    await onImageChange(null)
  }

  useEffect(() => {
    const currentFinalUrl = finalImageUrl
    // Cleanup function
    return () => {
      if (currentFinalUrl && currentFinalUrl.startsWith("blob:")) {
        URL.revokeObjectURL(currentFinalUrl)
      }
    }
  }, [finalImageUrl])

  // Effect to open dialog when a *new* file is ready
  useEffect(() => {
    // Check if fileId exists and is different from the previous one
    if (fileId && fileId !== previousFileIdRef.current) {
      setIsDialogOpen(true) // Open dialog for the new file
      setCroppedAreaPixels(null) // Reset crop area for the new file
      setZoom(1) // Reset zoom for the new file
    }
    // Update the ref to the current fileId for the next render
    previousFileIdRef.current = fileId
  }, [fileId]) // Depend only on fileId

  // Update finalImageUrl when currentImageUrl changes (e.g., from parent)
  useEffect(() => {
    if (currentImageUrl && !files.length) {
      setFinalImageUrl(currentImageUrl)
    }
  }, [currentImageUrl, files.length])

  // Get initials from user name
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ")
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return parts[0]?.[0]?.toUpperCase() || "U"
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative inline-flex">
        {/* Avatar display with upload button */}
        <Avatar className="h-24 w-24 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={openFileDialog}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <AvatarImage src={finalImageUrl || ""} alt={userName} />
          <AvatarFallback className="text-2xl">
            {userName ? getInitials(userName) : <UserIcon className="h-12 w-12" />}
          </AvatarFallback>
        </Avatar>
        
        {/* Remove button - depends on finalImageUrl */}
        {finalImageUrl && (
          <Button
            onClick={handleRemoveFinalImage}
            size="icon"
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
            aria-label="Remove image"
            disabled={isUploading}
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        )}
        <input
          {...getInputProps()}
          className="sr-only"
          aria-label="Upload image file"
          tabIndex={-1}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Click or drag to upload photo
      </p>

      {/* Cropper Dialog - Use isDialogOpen for open prop */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="gap-0 p-0 sm:max-w-[560px] *:[button]:hidden">
          <DialogDescription className="sr-only">
            Crop image dialog
          </DialogDescription>
          <DialogHeader className="contents space-y-0 text-left">
            <DialogTitle className="flex items-center justify-between border-b p-4 text-base">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-my-1 opacity-60"
                  onClick={() => setIsDialogOpen(false)}
                  aria-label="Cancel"
                >
                  <ArrowLeftIcon aria-hidden="true" />
                </Button>
                <span>Crop image</span>
              </div>
              <Button
                className="-my-1"
                onClick={handleApply}
                disabled={!previewUrl || isUploading}
                autoFocus
              >
                Apply
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <Cropper.Root
              className="h-96 sm:h-[480px]"
              image={previewUrl}
              zoom={zoom}
              onCropChange={handleCropChange}
              onZoomChange={setZoom}
            >
              <Cropper.Description />
              <Cropper.Image />
              <Cropper.CropArea />
            </Cropper.Root>
          )}
          <DialogFooter className="border-t px-4 py-6">
            <div className="mx-auto flex w-full max-w-80 items-center gap-4">
              <ZoomOutIcon
                className="shrink-0 opacity-60"
                size={16}
                aria-hidden="true"
              />
              <Slider
                defaultValue={[1]}
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(value) => setZoom(value[0])}
                aria-label="Zoom slider"
              />
              <ZoomInIcon
                className="shrink-0 opacity-60"
                size={16}
                aria-hidden="true"
              />
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
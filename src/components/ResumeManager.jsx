import React, { useState } from 'react'
import { storage } from '../firebase'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

export default function ResumeManager({ userId }){
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)

  const upload = () => {
    if (!file) return
    const storageRef = ref(storage, `resumes/${userId}/${file.name}`)
    const uploadTask = uploadBytesResumable(storageRef, file)
    uploadTask.on('state_changed', (snap) => {
      const pct = (snap.bytesTransferred / snap.totalBytes) * 100
      setProgress(Math.round(pct))
    }, console.error, async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref)
      console.log('Uploaded', url)
      setFile(null)
    })
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="font-semibold mb-2">Resume Manager</h3>
      <input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files[0])} />
      {file && <div className="mt-2">
        <button onClick={upload} className="px-3 py-1 bg-blue-600 text-white rounded">Upload</button>
        <div className="text-sm mt-1">{progress}%</div>
      </div>}
    </div>
  )
}

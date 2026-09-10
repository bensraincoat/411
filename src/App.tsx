import { useState, useEffect, useRef } from 'react'
import './App.css'

type DRGrade = 0 | 1 | 2 | 3 | 4

interface Prediction {
  filename: string
  grade: DRGrade
  label: string
  confidence: number
  message: string
}

interface PredictResponse {
  predictions: Prediction[]
}

function App() {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patientId, setPatientId] = useState<string>('') // State for patient ID
  const inputRef = useRef<HTMLInputElement>(null)
  const [assessments, setAssessments] = useState<any[]>([]) //new state variable for the saved assessments

  const loadAssessments = async () => {
    const res = await fetch('/api/assessments') //sends a request to the route recently created
    const data = await res.json() //stores the JSON response
    setAssessments(data.assessments) //saves the Flask assessments in the assessments state
  }
  useEffect(() => {
    loadAssessments() }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setFiles(selected)
    setPredictions([])
    setError(null)
    // revoke old object URLs to avoid memory leaks
    previews.forEach(url => URL.revokeObjectURL(url))
    setPreviews(selected.map(f => URL.createObjectURL(f)))
  }

  const handleProcess = async () => {
    if (files.length === 0) return
    if (patientId.trim() === '') {
      setError('Please enter a patient ID')
      return
    }
    setLoading(true)
    setError(null)
    setPredictions([])

    const formData = new FormData()
    formData.append('patient_id', patientId) //add the patient ID entered by the user to the form data
    files.forEach(f => formData.append('images', f))

    try {
      const res = await fetch('/api/predict', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data: PredictResponse = await res.json()
      setPredictions(data.predictions)
      await loadAssessments() //reload Assessment History after processing
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>openI</h1>
        <p>diabetic retinopathy detection</p>
      </header>

      <main className="app-main">
        <section className="upload-section">
          <h2>Upload Retinal Images</h2>
          <div className="upload-controls">
            <input
              type="text"
              placeholder="Patient ID"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
            />
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => inputRef.current?.click()}
            >
              Choose Files
            </button>
            <span className="file-count">
              {files.length === 0
                ? 'No files chosen'
                : `${files.length} file${files.length === 1 ? '' : 's'} selected`}
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={handleProcess}
              disabled={files.length === 0 || loading}
            >
              {loading ? 'Processing…' : 'Process'}
            </button>
          </div>

          {previews.length > 0 && (
            <div className="preview-grid">
              {previews.map((src, i) => (
                <div key={src} className="preview-card">
                  <img src={src} alt={files[i]?.name ?? `image ${i + 1}`} />
                  <p className="filename">{files[i]?.name}</p>
                  {predictions[i] && (
                    <div className={`result grade-${predictions[i].grade}`}>
                      <strong>{predictions[i].label}</strong>
                      <span className="confidence">
                        {(predictions[i].confidence * 100).toFixed(1)}% confidence
                      </span>
                      <p>{predictions[i].message}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="error">{error}</p>}
        </section>
        <h2>Assessment History</h2>
        {assessments.length === 0 ? (
          <p>No assessments yet</p>
        ) : (
          <div className="assessment-list">
            {assessments.map((assessment) => (
              <div key={assessment.id} className="assessment-card">
                <p>Assessment ID: {assessment.id}</p>
                <p>Patient ID: {assessment.patient_id}</p>
                <p>Image: {assessment.filename}</p>
                <p>Date: {new Date(assessment.date_created).toLocaleDateString()}</p>
                <p>Status: {assessment.status}</p>
                <p>Result: {assessment.label ?? 'Not available'}</p>
                <p>
                  Confidence: {assessment.confidence !== null 
                  ? `${(assessment.confidence * 100).toFixed(1)}%` 
                  : 'Not available'}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App

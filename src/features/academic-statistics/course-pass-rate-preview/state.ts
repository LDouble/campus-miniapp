import { useCallback, useEffect, useState } from 'react'
import {
  CoursePassRate,
  getCoursePassRatePreview,
} from '../repository'
import { isAcademicBindingRequiredError } from '../../academic-verification/binding-guidance'

export type CoursePassRatePreviewState = {
  bindingRequired: boolean
  data: CoursePassRate | null
  error: unknown
  fromCache: boolean
  loading: boolean
  reload: () => void
}

export const useCoursePassRatePreview = (
  courseCode: string,
): CoursePassRatePreviewState => {
  const [data, setData] = useState<CoursePassRate | null>(null)
  const [loading, setLoading] = useState(Boolean(courseCode.trim()))
  const [fromCache, setFromCache] = useState(false)
  const [bindingRequired, setBindingRequired] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  const reload = useCallback(() => {
    setReloadVersion((current) => current + 1)
  }, [])

  useEffect(() => {
    const normalized = courseCode.trim()
    if (!normalized) {
      setLoading(false)
      setData(null)
      setFromCache(false)
      setBindingRequired(false)
      setError(null)
      return undefined
    }
    let active = true
    setLoading(true)
    setData(null)
    setFromCache(false)
    setBindingRequired(false)
    setError(null)
    getCoursePassRatePreview(normalized)
      .then((result) => {
        if (!active) return
        const nextData = result.data && Number.isFinite(result.data.pass_rate)
          ? result.data
          : null
        setData(nextData)
        setFromCache(Boolean(nextData) && result.fromCache)
      })
      .catch((nextError) => {
        if (!active) return
        setData(null)
        setFromCache(false)
        setBindingRequired(isAcademicBindingRequiredError(nextError))
        setError(nextError)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [courseCode, reloadVersion])

  return {
    bindingRequired,
    data,
    error,
    fromCache,
    loading,
    reload,
  }
}

import React, { useState } from 'react'
import assets from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const navigate = useNavigate()

  const onSubmitHandler = async (event) => {
    event.preventDefault()
    if (!email) return

    setLoading(true)
    setGeneratedLink('')
    try {
      const { data } = await axios.post('/api/auth/forgot-password', { email })
      if (data.success) {
        toast.success(data.message || 'Reset link sent to your email')
        if (data.resetUrl) {
          setGeneratedLink(data.resetUrl)
        }
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-cover bg-center flex items-center 
    justify-center gap-8 sm:justify-evenly max-sm:flex-col backdrop-blur-2xl'>
      {/* Left Side */}
      <img src={assets.logo_big} alt="QuickChat" className='w-[min(30vw,250px)]' />

      {/* Right Side */}
      <form onSubmit={onSubmitHandler} className='border-2 bg-white/8 text-white 
      border-gray-500 p-6 flex flex-col gap-6 rounded-lg shadow-lg w-[min(90vw,400px)]'>
        <div>
          <h2 className='font-medium text-2xl'>Forgot Password</h2>
          <p className='text-sm text-gray-400 mt-1'>
            Enter your registered email and we'll send you a password reset link valid for 15 minutes.
          </p>
        </div>

        <input
          onChange={(e) => setEmail(e.target.value)}
          value={email}
          type="email"
          placeholder="Email Address"
          required
          className='p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-white'
        />

        <button
          type="submit"
          disabled={loading}
          className='py-3 bg-gradient-to-r from-purple-400 to-violet-600 text-white rounded-md cursor-pointer disabled:opacity-50 font-medium'
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>

        {generatedLink && (
          <div className='p-3 bg-violet-950/70 border border-violet-500/50 rounded-lg text-sm text-center flex flex-col gap-2'>
            <p className='text-violet-200 text-xs font-medium'>
              SMTP credentials are empty in server/.env. You can reset directly below:
            </p>
            <a
              href={generatedLink}
              className='py-2.5 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-md font-medium text-xs transition-colors shadow'
            >
              👉 Click Here to Reset Password Now
            </a>
          </div>
        )}

        <div className='text-center'>
          <p className='text-sm text-gray-400'>
            Remember your password?{' '}
            <span
              onClick={() => navigate('/Login')}
              className='font-medium text-violet-400 cursor-pointer hover:underline'
            >
              Back to Login
            </span>
          </p>
        </div>
      </form>
    </div>
  )
}

export default ForgotPasswordPage

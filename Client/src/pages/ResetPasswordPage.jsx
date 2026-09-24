import React, { useState } from 'react'
import assets from '../assets/assets'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'

const ResetPasswordPage = () => {
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onSubmitHandler = async (event) => {
    event.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const { data } = await axios.post(`/api/auth/reset-password/${token}`, {
        password,
        confirmPassword,
      })

      if (data.success) {
        toast.success(data.message || 'Password reset successful, please login')
        navigate('/Login')
      } else {
        toast.error(data.message || 'Link expired, please try again')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Link expired, please try again')
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
          <h2 className='font-medium text-2xl'>Reset Password</h2>
          <p className='text-sm text-gray-400 mt-1'>
            Please enter and confirm your new password below.
          </p>
        </div>

        <input
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          type="password"
          placeholder="New Password (min 6 characters)"
          required
          className='p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-white'
        />

        <input
          onChange={(e) => setConfirmPassword(e.target.value)}
          value={confirmPassword}
          type="password"
          placeholder="Confirm Password"
          required
          className='p-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-white'
        />

        <button
          type="submit"
          disabled={loading}
          className='py-3 bg-gradient-to-r from-purple-400 to-violet-600 text-white rounded-md cursor-pointer disabled:opacity-50 font-medium'
        >
          {loading ? 'Resetting Password...' : 'Reset Password'}
        </button>

        <div className='text-center'>
          <p className='text-sm text-gray-400'>
            Back to{' '}
            <span
              onClick={() => navigate('/Login')}
              className='font-medium text-violet-400 cursor-pointer hover:underline'
            >
              Login
            </span>
          </p>
        </div>
      </form>
    </div>
  )
}

export default ResetPasswordPage

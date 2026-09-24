import React, {useContext} from 'react'
import {Navigate, Route,  Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import {Toaster} from 'react-hot-toast'
import { AuthContext } from '../context/AuthContext.jsx'

const App = () => {
  const {authUser} = useContext(AuthContext)
  return (
    <div className="bg-[url('./assets/bgImage.svg')] bg-contain">
      <Toaster />
      <Routes>
        <Route path='/' element={authUser ? <HomePage /> : <Navigate to="/Login" />}/>
        <Route path='/Login' element={!authUser ? <LoginPage /> : <Navigate to="/" />}/>
        <Route path='/forgot-password' element={!authUser ? <ForgotPasswordPage /> : <Navigate to="/" />}/>
        <Route path='/reset-password/:token' element={!authUser ? <ResetPasswordPage /> : <Navigate to="/" />}/>
        <Route path='/profile' element={authUser ? <ProfilePage /> : <Navigate to="/Login" />}/>
      </Routes>
    </div>
  )
}

export default App

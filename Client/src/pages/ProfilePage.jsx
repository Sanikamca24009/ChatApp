import React, { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import assets from '../assets/assets';
import { AuthContext } from '../../context/AuthContext';

const ProfilePage = () => {
  const { authUser, updateProfile } = useContext(AuthContext);
  const [selectedImg, setSelectedImg] = useState(null);
  const navigate = useNavigate();
  const [name, setName] = useState(authUser?.fullName || "");
  const [bio, setBio] = useState(authUser?.bio || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (!selectedImg) {
        await updateProfile({ fullName: name, bio });
        navigate('/');
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(selectedImg);
      reader.onload = async () => {
        const base64Image = reader.result;
        await updateProfile({ profilePic: base64Image, fullName: name, bio });
        navigate('/');
      };
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='min-h-screen bg-cover bg-no-repeat flex items-center justify-center p-4 bg-[#0d0e15]'>
      <div className='w-full max-w-2xl backdrop-blur-2xl bg-[#161622]/90 text-gray-300 border border-white/10 flex items-center justify-between max-sm:flex-col-reverse rounded-2xl shadow-2xl overflow-hidden relative'>
        {/* Top Back Arrow inside container */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 p-2 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer z-10 flex items-center justify-center"
          title="Back to chat"
          aria-label="Back to chat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 sm:p-10 flex-1 w-full pt-14 sm:pt-14">
          <div className="flex items-center">
            <h3 className="text-xl font-semibold text-white ml-8 sm:ml-7">Profile Details</h3>
          </div>

          <label
            htmlFor="avatar"
            className='flex items-center gap-3 cursor-pointer group w-fit'
          >
            <input
              onChange={(e) => setSelectedImg(e.target.files[0])}
              type="file"
              id='avatar'
              accept='.png, .jpg, .jpeg'
              hidden
            />
            <div className="relative">
              <img
                src={
                  selectedImg
                    ? URL.createObjectURL(selectedImg)
                    : authUser?.profilePic || assets.avatar_icon
                }
                alt="Profile avatar"
                className="w-13 h-13 rounded-full object-cover border-2 border-violet-500/60 shadow group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              {selectedImg ? "Change selected image" : "Upload profile image"}
            </span>
          </label>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium">Full Name</label>
            <input
              onChange={(e) => setName(e.target.value)}
              value={name}
              type="text"
              required
              placeholder='Your Name'
              className='p-2.5 bg-[#201a35]/80 border border-white/15 rounded-xl text-white outline-none focus:border-violet-500 transition-all text-sm'
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium">Bio</label>
            <textarea
              onChange={(e) => setBio(e.target.value)}
              value={bio}
              placeholder="Write profile bio"
              required
              rows={3}
              className="p-2.5 bg-[#201a35]/80 border border-white/15 rounded-xl text-white outline-none focus:border-violet-500 transition-all text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 rounded-full border border-white/15 hover:bg-white/10 text-gray-300 hover:text-white text-sm font-medium transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white py-2.5 px-4 rounded-full text-sm font-medium shadow-lg shadow-violet-600/30 transition-all cursor-pointer text-center disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>

        <div className="flex flex-col items-center justify-center p-8 max-sm:pb-0">
          <img
            className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-violet-500/30 shadow-2xl"
            src={
              selectedImg
                ? URL.createObjectURL(selectedImg)
                : authUser?.profilePic || assets.logo_icon
            }
            alt="Profile Preview"
          />
        </div>
      </div>
    </div>
  );
};

export default ProfilePage

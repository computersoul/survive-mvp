import React from 'react';

const WaitingScreen = () => (
  <div className="min-h-screen min-w-full bg-black flex items-center justify-center text-white text-xl">
    <div className="flex flex-col items-center gap-4">
      <p>Waiting for a new lobby to be created...</p>
    </div>
  </div>
);

export default WaitingScreen;
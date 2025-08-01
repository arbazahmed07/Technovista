import React, { useState } from 'react';
import Login from './Login';
import Signup from './Signup';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);

  const toggleAuth = () => {
    setIsLogin(!isLogin);
  };

  return (
    <>
      {isLogin ? (
        <Login onToggle={toggleAuth} />
      ) : (
        <Signup onToggle={toggleAuth} />
      )}
    </>
  );
};

export default Auth;
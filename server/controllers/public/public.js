'use strict';

/** Login */
exports.login = async (req, res) => {
  let email = req.body.email || '';
  let password = req.body.password || '';
  //console.log(req.body);
  if (email === '' || password === '') {
    return res.status(401).json({
      "status": 401,
      "message": "No Credentials Provided"
    });
  }
  else
  {
    return res.status(400).json({
      "status": 400,
      "message": "Invalid credentials - Development pending"
    });
  }
}

exports.logout = (req, res) =>{
  res.status(200).json({"status":200,"message":"OK"});
}
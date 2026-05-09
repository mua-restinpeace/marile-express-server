const success = (res, data = null, message = "Success", statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const error = (
  res,
  message = "An error occured",
  statusCode = 500,
  errors = null,
) => {
  const body = { succes: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

module.exports = { success, error };

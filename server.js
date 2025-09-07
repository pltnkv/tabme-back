const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.type('text/plain').send('hello Oleg');
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});

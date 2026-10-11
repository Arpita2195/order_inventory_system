const { app, port } = require('./src/app');

app.listen(port, () => {
  console.log(`StockFlow backend running on http://localhost:${port}`);
});

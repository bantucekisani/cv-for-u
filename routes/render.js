// routes/render.js
const express = require("express");
const router = express.Router();
const renderCvHTML = require("../utils/renderTemplate");


router.post("/render", (req, res) => {
  try {
    const cv = req.body;
    const html = renderCvHTML(cv);
    res.send(html);
  } catch (err) {
    console.error("❌ Render error:", err);
    res.status(500).send("Render failed");
  }
});

module.exports = router;

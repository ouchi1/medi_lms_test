const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const lessonRoutes = require('./lessonRoutes');
const qcmRoutes = require('./qcmRoutes');
const subjectRoutes = require('./subjectRoutes');
const schoolRoutes = require('./schoolRoutes');

router.use('/auth', authRoutes);
router.use('/lessons', lessonRoutes);
router.use('/qcm', qcmRoutes);
router.use('/subjects', subjectRoutes);
router.use('/schools', schoolRoutes);

module.exports = router;
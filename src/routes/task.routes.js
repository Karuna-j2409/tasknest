const express = require('express');
const validate = require('../middlewares/validate');
const controller = require('../controllers/task.controller');
const { taskSchema, patchSchema, idParamSchema, listQuerySchema } = require('../validators/task.validator');

const router = express.Router();

// /stats must come before /:id, otherwise "stats" would be treated as an id
router.get('/stats', controller.getStats);

router.get('/', validate(listQuerySchema, 'query'), controller.getAll);
router.post('/', validate(taskSchema), controller.create);

router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.put('/:id', validate(idParamSchema, 'params'), validate(taskSchema), controller.update);
router.patch('/:id', validate(idParamSchema, 'params'), validate(patchSchema), controller.update);
router.delete('/:id', validate(idParamSchema, 'params'), controller.remove);

module.exports = router;

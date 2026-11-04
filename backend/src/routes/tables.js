import {Router} from 'express';
import {body, param} from 'express-validator';
import TableDAO, {TableError} from '../dao/TableDAO.js';
import validateRequest from '../middlewares/validateParams.js';
import {isStaff} from '../middlewares/auth.js';

const router = Router();

// Validation rules: if one fails, validateRequest responds 422 before reaching the route
const tableIdParam = param('tableId').isUUID().withMessage('tableId must be a valid UUID');

const tableBodyRules = [
  body('number').isString().notEmpty().withMessage('number must be a non-empty string'),
  body('seats').custom((value) => Number.isInteger(value) && value > 0).withMessage('seats must be a positive integer'),
];

router.get('/', isStaff, async (req, res) => {
  try {
    const tables = await TableDAO.getTables();
    res.status(200).json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', isStaff, tableBodyRules, validateRequest, async (req, res) => {
  try {
    const { number, seats } = req.body;
    const newTable = await TableDAO.createTable({ number, seats });
    res.status(201).json(newTable);
  } catch (error) {
    if (error.code === 'P2002') { 
        return res.status(409).json({ error: "Table number already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:tableId', isStaff, tableIdParam, tableBodyRules, validateRequest, async (req, res) => {
  try {
    const tableId = req.params.tableId;
    const { number, seats } = req.body;

    const updatedTable = await TableDAO.updateTable(tableId, { number, seats });
    res.status(200).json(updatedTable);
  } catch (error) {
    if (error instanceof TableError) {
        return res.status(409).json({ error: error.message });
    }
    if (error.code === 'P2025') {
        return res.status(404).json({ error: "Table not found" });
    }
    if (error.code === 'P2002') { 
        return res.status(409).json({ error: "Table number already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:tableId', isStaff, tableIdParam, validateRequest, async (req, res) => {
  try {
    const tableId = req.params.tableId;
    await TableDAO.deleteTable(tableId);
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
        return res.status(404).json({ error: "Table not found" });
    }
    if (error.message.includes("Cannot delete a table that is scheduled in a slot or has active reservations")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
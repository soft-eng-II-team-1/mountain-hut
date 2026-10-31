import {Router} from 'express';
import TableDAO from '../dao/TableDAO';
import {isStaff} from '../middleware/auth';

const router = Router();

router.post('/', isStaff, async (req, res) => {
  try {
    const { number, seats } = req.body;
    if (!number || typeof number !== 'string' || !seats || typeof seats !== 'number') {
        return res.status(400).json({ error: "Invalid input: requires string 'number' and integer 'seats'" });
    }
    const newTable = await TableDAO.createTable({ number, seats });
    res.status(201).json(newTable);
  } catch (error) {
    if (error.code === 'P2002') { 
        return res.status(409).json({ error: "Table number already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:tableId', isStaff, async (req, res) => {
  try {
    const tableId = req.params.tableId;
    const { number, seats } = req.body;

    if (!number || typeof number !== 'string' || !seats || typeof seats !== 'number') {
        return res.status(400).json({ error: "Invalid input: requires string 'number' and integer 'seats'" });
    }

    const updatedTable = await TableDAO.updateTable(tableId, { number, seats });
    res.status(200).json(updatedTable);
  } catch (error) {
    if (error.code === 'P2025') {
        return res.status(404).json({ error: "Table not found" });
    }
    if (error.code === 'P2002') { 
        return res.status(409).json({ error: "Table number already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:tableId', isStaff, async (req, res) => {
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
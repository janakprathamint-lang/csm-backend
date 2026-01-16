import { Request, Response } from "express";
import { createLeadType, deleteLeadType, getAllLeadTypes, updateLeadType } from "../models/leadType.model";

/* ==============================
   CREATE
============================== */
export const createLeadTypeController = async (
  req: Request,
  res: Response
) => {
  try {
    const leadType = await createLeadType(req.body);
    res.status(201).json({ success: true, data: leadType });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* ==============================
   GET
============================== */
export const getLeadTypesController = async (
  req: Request,
  res: Response
) => {
  const leadTypes = await getAllLeadTypes();
  res.json({ success: true, data: leadTypes });
};

/* ==============================
   UPDATE
============================== */
export const updateLeadTypeController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new Error("Invalid lead type id");
    const updated = await updateLeadType(id, req.body);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* ==============================
   DELETE
============================== */
export const deleteLeadTypeController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new Error("Invalid lead type id");

    const result = await deleteLeadType(id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

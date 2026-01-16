import { Request, Response } from "express";
import {
  createSaleType,
  getAllSaleTypes,
  updateSaleType,
  deleteSaleType,
} from "../models/saleType.model";

/* ==============================
   CREATE
============================== */
export const createSaleTypeController = async (
  req: Request,
  res: Response
) => {
  try {
    const saleType = await createSaleType(req.body);
    res.status(201).json({ success: true, data: saleType });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* ==============================
   GET
============================== */
export const getSaleTypesController = async (
  req: Request,
  res: Response
) => {
  const saleTypes = await getAllSaleTypes();
  res.json({ success: true, data: saleTypes });
};

/* ==============================
   UPDATE
============================== */
export const updateSaleTypeController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new Error("Invalid sale type id");
    const updated = await updateSaleType(id, req.body);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* ==============================
   DELETE
============================== */
export const deleteSaleTypeController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new Error("Invalid sale type id");

    const result = await deleteSaleType(id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

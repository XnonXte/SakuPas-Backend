import { Router } from "express";
import * as auth from "../controllers/authController.js";
import * as accounts from "../controllers/accountController.js";
import * as budgets from "../controllers/budgetController.js";
import * as categories from "../controllers/categoryController.js";
import * as dashboard from "../controllers/dashboardController.js";
import * as modeHemat from "../controllers/modeHematController.js";
import * as payLater from "../controllers/payLaterController.js";
import * as transactions from "../controllers/transactionController.js";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
const secure = (handler) => [authenticate, asyncHandler(handler)];

router.post("/register", asyncHandler(auth.register));
router.post("/login", asyncHandler(auth.login));

router.post("/logout", ...secure(auth.logout));
router.get("/user", ...secure(auth.user));
router.put("/user", ...secure(auth.updateProfile));

router.get("/dashboard", ...secure(dashboard.index));
router.get("/dashboard/cash-flow", ...secure(dashboard.cashFlow));
router.get("/dashboard/expense-distribution", ...secure(dashboard.expenseDistribution));
router.get("/dashboard/safe-to-spend", ...secure(dashboard.safeToSpend));

router.get("/accounts", ...secure(accounts.index));
router.post("/accounts", ...secure(accounts.store));
router.get("/accounts/:account", ...secure(accounts.show));
router.put("/accounts/:account", ...secure(accounts.update));
router.patch("/accounts/:account", ...secure(accounts.update));
router.delete("/accounts/:account", ...secure(accounts.destroy));

router.get("/categories", ...secure(categories.index));
router.post("/categories", ...secure(categories.store));
router.delete("/categories/:category", ...secure(categories.destroy));

router.get("/transactions", ...secure(transactions.index));
router.post("/transactions", ...secure(transactions.store));
router.get("/transactions/:transaction", ...secure(transactions.show));
router.put("/transactions/:transaction", ...secure(transactions.update));
router.patch("/transactions/:transaction", ...secure(transactions.update));
router.delete("/transactions/:transaction", ...secure(transactions.destroy));

router.get("/paylater", ...secure(payLater.index));
router.post("/paylater", ...secure(payLater.store));
router.get("/paylater/:paylater", ...secure(payLater.show));
router.put("/paylater/:paylater", ...secure(payLater.update));
router.delete("/paylater/:paylater", ...secure(payLater.destroy));
router.post("/paylater/:paylater/toggle-paid", ...secure(payLater.togglePaid));
router.get("/paylater/:paylater/repayments", ...secure(payLater.repayments));
router.post("/paylater/:paylater/repayments", ...secure(payLater.recordRepayment));

router.get("/budgets", ...secure(budgets.index));
router.post("/budgets", ...secure(budgets.store));
router.delete("/budgets/:budget", ...secure(budgets.destroy));

router.get("/mode-hemat", ...secure(modeHemat.index));
router.post("/mode-hemat/activate", ...secure(modeHemat.activate));
router.post("/mode-hemat/deactivate", ...secure(modeHemat.deactivate));

export default router;

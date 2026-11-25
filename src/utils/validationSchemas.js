export const registerSchema = {
  name: ["required", "string", "max:255"],
  email: ["required", "string", "email", "max:255"],
  password: ["required", "string", "min8", "confirmed"],
};

export const loginSchema = {
  email: ["required", "string", "email"],
  password: ["required", "string"],
};

export const accountSchema = {
  name: ["required", "string", "max:150"],
  account_type: ["required", "string", "oneOf:bank,ewallet,cash,other"],
  balance: ["required", "integer", "min:0"],
  description: ["nullable", "string", "max:255"],
};

export const categorySchema = {
  name: ["required", "string", "max:150"],
  type: ["required", "oneOf:income,expense"],
  sublabel: ["nullable", "string", "max:255"],
  icon: ["nullable", "string", "max:50"],
  color: ["nullable", "string", "max:20"],
};

export const transactionSchema = {
  account_id: ["required", "integer"],
  category_id: ["required", "integer"],
  type: ["required", "oneOf:income,expense"],
  amount: ["required", "integer", "min:1"],
  description: ["required", "string", "max:255"],
  transaction_date: ["required", "date"],
  payment_method: ["nullable", "string", "max:100"],
  notes: ["nullable", "string", "max:1000"],
};

export const budgetSchema = {
  category_id: ["required", "integer"],
  amount: ["required", "integer", "min:0"],
  month: ["nullable", "integer", "between:1,12"],
  year: ["nullable", "integer", "min:2020"],
};

export const payLaterBillSchema = {
  provider_name: ["required", "string", "max:150"],
  description: ["nullable", "string", "max:255"],
  total_amount: ["required", "integer", "min:1"],
  due_date: ["required", "date"],
  installment_info: ["nullable", "string", "max:150"],
};

export const repaymentSchema = {
  amount: ["required", "integer", "min:1"],
  account_id: ["nullable", "integer"],
  repayment_date: ["nullable", "date"],
  notes: ["nullable", "string", "max:255"],
};

export const profileSchema = {
  name: ["required", "string", "max:255"],
  email: ["required", "string", "email", "max:255"],
};

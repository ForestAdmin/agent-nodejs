const FormData: any = jest.fn(function FormData() {});
FormData.prototype.append = jest.fn();
FormData.prototype.getHeaders = jest.fn().mockReturnValue({});
FormData.prototype.submit = jest.fn();

export default FormData;
export const append = FormData.prototype.append as jest.Mock;
export const getHeaders = FormData.prototype.getHeaders as jest.Mock;
export const submit = FormData.prototype.submit as jest.Mock;

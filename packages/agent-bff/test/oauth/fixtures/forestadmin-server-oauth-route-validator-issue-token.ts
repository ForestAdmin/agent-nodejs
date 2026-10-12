import Joi from 'joi';

const issueTokenBodySchema = Joi.object({
  client_id: Joi.string().required(),
  grant_type: Joi.string().valid('authorization_code', 'refresh_token').required(),
  code: Joi.string().when('grant_type', {
    is: 'authorization_code',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  redirect_uri: Joi.string().uri().when('grant_type', {
    is: 'authorization_code',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  code_verifier: Joi.string().when('grant_type', {
    is: 'authorization_code',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  refresh_token: Joi.string().when('grant_type', {
    is: 'refresh_token',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  scope: Joi.string().when('grant_type', {
    is: 'refresh_token',
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
}).required();

export default issueTokenBodySchema;

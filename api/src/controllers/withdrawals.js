'use strict'

module.exports = WithdrawalsControllerFactory

const Auth = require('../lib/auth')
const Config = require('../lib/config')
const Pay = require('../lib/pay')
const Paypal = require('../lib/paypal')
const UserFactory = require('../models/user')
const WithdrawalFactory = require('../models/withdrawal')
const NotFoundError = require('../errors/not-found-error')
const InvalidBodyError = require('../errors/invalid-body-error')
const LedgerInsufficientFundsError = require('../errors/ledger-insufficient-funds-error')
const ServerError = require('../errors/server-error.js')

const request = require('superagent')

function WithdrawalsControllerFactory (deps) {
  const auth = deps(Auth)
  const config = deps(Config)
  const pay = deps(Pay)
  const User = deps(UserFactory)
  const Withdrawal = deps(WithdrawalFactory)
  const paypal = deps(Paypal)

  return class WithdrawalsController {
    static init (router) {
      router.post('/withdrawals/:id', auth.checkAuth, this.postResource)

      // Admin
      router.get('/withdrawals', auth.checkAuth, this.checkAdmin, this.getAll)
      router.put('/withdrawals/:id', auth.checkAuth, this.checkAdmin, this.putResource)
    }

    // TODO move to auth
    static async checkAdmin (ctx, next) {
      if (ctx.req.user.username === config.data.getIn(['ledger', 'admin', 'user'])) {
        return next()
      }

      throw new NotFoundError()
    }

    /**
     * @api {POST} /withdrawals/:id Withdraw
     * @apiName PutWithdrawals
     * @apiGroup Withdrawal
     * @apiVersion 1.0.0
     * @apiPermission user
     *
     * @apiDescription Withdraw
     *
     * @apiParam {UUID} id withdrawal id
     *
     * @apiExample {shell} Withdraw
     *    curl -X POST -H "Authorization: Basic YWxpY2U6YWxpY2U=" -d
     *    '{
     *        "amount": 10
     *    }'
     *    https://wallet.example/withdrawals/23163cfd-cc83-4991-9b10-f89d1b2fc095
     *
     * @apiSuccessExample {json} 201 Response:
     *    HTTP/1.1 201 OK
     */
    static async postResource (ctx) {
      if (!ctx.body.amount) throw new InvalidBodyError("Request doesn't include an amount")
      if (!ctx.body.paypal) throw new InvalidBodyError("Request doesn't include a paypal address")

      const dbUser = await User.findOne({where: {username: ctx.req.user.username}})
      const user = await dbUser.appendLedgerAccount()

      if (user.balance - ctx.body.amount < user.minimum_allowed_balance) {
          throw new LedgerInsufficientFundsError()
      }

      try {

        //await paypal.payout(ctx.body.paypal, ctx.body.amount)

          const DOMAIN_NAME = process.env.API_MAILGUN_DOMAIN;
          const API_KEY = process.env.API_MAILGUN_API_KEY;

          const res = await request
              .post(`https://api.mailgun.net/v3/${DOMAIN_NAME}/messages`)
              .auth('api', API_KEY, {type: 'auto'})
              .field('from', process.env.API_EMAIL_SENDER_ADDRESS)
              .field('to', process.env.API_EMAIL_PAYPAL_ADMIN)
              .field('subject', 'Withdrawal Request')
              .field('text', `Withdrawal Request\nUsername: ${ctx.req.user.username}\nAmount: $${ctx.body.amount}\nPayPal Address: ${ctx.body.paypal}\nGo to PayPal: https://www.paypal.com`)
              .send();

          if (res.statusCode != 200) {
              throw new ServerError('Mailgun error - ' + res.body)
          }

      } catch (e) {
          throw new ServerError('Mailgun error - ' + e.message)
      }

      try {
        await pay.withdraw(ctx.req.user, ctx.body.amount)
      } catch (e) {
        throw new LedgerInsufficientFundsError()
      }

      ctx.status = 201

    }

    /**
     * @api {GET} /withdrawals Get all withdrawals
     * @apiName GetWithdrawals
     * @apiGroup Withdrawal
     * @apiVersion 1.0.0
     * @apiPermission admin
     *
     * @apiDescription Get all withdrawals
     *
     * @apiExample {shell} Get all withdrawals
     *    curl -X GET -H "Authorization: Basic YWxpY2U6YWxpY2U="
     *    https://wallet.example/withdrawals
     *
     * @apiSuccessExample {json} 200 Response:
     *    HTTP/1.1 200 OK
     *    [
     *       {
     *           "id": "23163cfd-cc83-4991-9b10-f89d1b2fc095",
     *           "amount": 1,
     *           "status": "pending",
     *           "transfer_id": "abf0f73f-4c64-4c84-864d-a3b1a1df2faa",
     *           "created_at": "2017-06-13T22:36:18.899Z",
     *           "updated_at": "2017-06-13T22:36:18.899Z",
     *           "user_id": 2,
     *           "User": {
     *               "id": 2,
     *               "username": "alice",
     *               "email": "alice@example.com",
     *               "email_verified": true,
     *               "github_id": null,
     *               "destination": "451744",
     *               "profile_picture": "upload_3a252b77b8f4c76f3037d7df30892441_square.jpeg",
     *               "name": "Alice Jan",
     *               "phone": null,
     *               "address1": null,
     *               "address2": null,
     *               "city": null,
     *               "region": null,
     *               "country": null,
     *               "zip_code": null,
     *               "created_at": "2016-12-02T22:27:49.360Z",
     *               "updated_at": "2017-06-02T20:20:29.214Z",
     *               "invite_code": null
     *           },
     *           "ActivityLogs": [
     *               {
     *                   "id": "8289447f-7269-420e-894e-d61cbf2ffd87",
     *                   "stream_id": null,
     *                   "created_at": "2017-06-13T22:36:18.964Z",
     *                   "updated_at": "2017-06-13T22:36:18.964Z",
     *                   "user_id": 2,
     *                   "ActivityLogsItem": {
     *                       "id": 4894,
     *                       "activity_log_id": "8289447f-7269-420e-894e-d61cbf2ffd87",
     *                       "item_type": "withdrawal",
     *                       "item_id": "23163cfd-cc83-4991-9b10-f89d1b2fc095",
     *                       "created_at": "2017-06-13T22:36:18.995Z",
     *                       "updated_at": "2017-06-13T22:36:18.995Z"
     *                   }
     *               }
     *           ]
     *       }
     *    ]
     */
    static async getAll (ctx) {
      // TODO pagination
      // TODO don't return all of the fields / associations
      ctx.body = await Withdrawal.findAll({
        include: [{ all: true }],
        order: [['created_at', 'DESC']]
      })
    }

    /**
     * @api {PUT} /withdrawals/:id Update withdrawal
     * @apiName PutWithdrawals
     * @apiGroup Withdrawal
     * @apiVersion 1.0.0
     * @apiPermission admin
     *
     * @apiDescription Update withdrawal
     *
     * @apiParam {UUID} id withdrawal id
     *
     * @apiExample {shell} Update withdrawal
     *    curl -X PUT -H "Authorization: Basic YWxpY2U6YWxpY2U=" -d
     *    '{
     *        "status": "complete"
     *    }'
     *    https://wallet.example/withdrawals/23163cfd-cc83-4991-9b10-f89d1b2fc095
     *
     * @apiSuccessExample {json} 200 Response:
     *    HTTP/1.1 200 OK
     *   {
     *     "id": "23163cfd-cc83-4991-9b10-f89d1b2fc095",
     *     "amount": 1,
     *     "status": "complete",
     *     "transfer_id": "abf0f73f-4c64-4c84-864d-a3b1a1df2faa",
     *     "created_at": "2017-06-13T22:36:18.899Z",
     *     "updated_at": "2017-06-15T18:51:42.372Z",
     *     "user_id": 2
     *   }
     */
    static async putResource (ctx) {
      const id = ctx.params.id
      const data = ctx.body

      const withdrawal = await Withdrawal.findOne({ where: { id } })

      if (!withdrawal) throw new NotFoundError()

      if (data.status !== undefined) {
        withdrawal.status = data.status
      }

      ctx.body = await withdrawal.save()
    }
  }
}

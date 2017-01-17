import * as types from '../actionTypes'

export const load = () => ({
  types: [types.LOAD_PEERS, types.LOAD_PEERS_SUCCESS, types.LOAD_PEERS_FAIL],
  promise: (client) => client.get('/peers')
})

export const add = data => ({
  types: [types.ADD_PEER, types.ADD_PEER_SUCCESS, types.ADD_PEER_FAIL],
  promise: (client) => client.post('/peers', {data})
})

export const update = (id, data) => ({
  types: [types.UPDATE_PEER, types.UPDATE_PEER_SUCCESS, types.UPDATE_PEER_FAIL],
  promise: (client) => client.put('/peers/' + id, {data})
})

export const remove = id => ({
  types: [types.REMOVE_PEER, types.REMOVE_PEER_SUCCESS, types.REMOVE_PEER_FAIL],
  promise: (client) => client.del('/peers/' + id)
})


/**
 * @typedef {'male' | 'female'} Gender
 */

/**
 * @typedef {Object} AuthTelegramBody
 * @property {string} init_data
 */

/**
 * @typedef {Object} AuthTelegramResponse
 * @property {string} token
 * @property {{ id: number, nickname: string, gender: Gender, profile_complete: boolean }} user
 */

/**
 * @typedef {Object} MeResponse
 * @property {string} nickname
 * @property {Gender} gender
 * @property {string | null} real_name
 * @property {string | null} department
 * @property {boolean} profile_complete
 */

/**
 * @typedef {Object} BrowseItem
 * @property {number} id
 * @property {string} nickname
 * @property {string} created_at
 */

/**
 * @typedef {Object} LikeRequest
 * @property {number} to_user_id
 */

/**
 * @typedef {Object} LikeResponse
 * @property {boolean} matched
 * @property {string | null} match_id
 */

/**
 * @typedef {Object} MatchItem
 * @property {string} match_id
 * @property {string} matched_at
 * @property {{ id: number, nickname: string }} other_user
 * @property {boolean} i_shared_contact
 * @property {boolean} they_shared_contact
 */

/**
 * @typedef {Object} ReportRequest
 * @property {number} reported_id
 * @property {string} reason
 */

/**
 * @typedef {Object} KeywordIdsRequest
 * @property {number[]} keyword_ids
 */

export const __types = null

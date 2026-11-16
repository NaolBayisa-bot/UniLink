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
 * @typedef {Object} ShareContactResponse
 * @property {boolean} i_shared_contact
 * @property {boolean} they_shared_contact
 */

/**
 * @typedef {Object} UnmatchRequest
 * @property {string} match_id
 */

/**
 * @typedef {Object} BlockRequest
 * @property {number} blocked_id
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

/**
 * @typedef {Object} MatchProfileResponse
 * @property {string} nickname
 * @property {Gender} gender
 * @property {string | null} real_name
 * @property {string | null} department
 * @property {boolean} i_shared_contact
 * @property {string} [telegram_username]
 * @property {boolean} [has_shared_contact]
 * @property {boolean} [contact_unavailable]
 */

/**
 * @typedef {Object} PendingPhoto
 * @property {number} user_id
 * @property {string} nickname
 * @property {string} photo_submitted_at
 * @property {string} view_url
 */

/**
 * @typedef {Object} PhotoReviewRequest
 * @property {number} user_id
 * @property {'approve' | 'reject'} decision
 * @property {'not_a_face' | 'explicit' | 'other'} reason
 */

/**
 * @typedef {Object} AdminReport
 * @property {string} id
 * @property {number} reporter_id
 * @property {number} reported_id
 * @property {string} reason
 * @property {'open' | 'resolved'} status
 * @property {string} created_at
 */

/**
 * @typedef {Object} ResolveReportRequest
 * @property {string} report_id
 */

/**
 * @typedef {Object} BanUserRequest
 * @property {number} user_id
 */

/**
 * @typedef {Object} AdminUser
 * @property {number} id
 * @property {string} nickname
 * @property {string} real_name
 * @property {string} department
 * @property {Gender} gender
 * @property {string} telegram_username
 * @property {string} status
 * @property {'basic' | 'google' | 'id'} verification_level
 * @property {boolean} email_verified
 * @property {string | null} flagged_at
 * @property {string} signup_ip
 * @property {string} created_at
 * @property {number} open_reports_against
 * @property {number} reports_filed
 * @property {number} active_matches
 */

/**
 * @typedef {Object} SetVerificationLevelRequest
 * @property {number} user_id
 * @property {'basic' | 'google' | 'id'} verification_level
 */

/**
 * @typedef {Object} PassRequest
 * @property {number} user_id
 */

/**
 * @typedef {Object} TicketRequest
 * @property {string} match_id
 */

/**
 * @typedef {Object} TicketResponse
 * @property {string} ticket
 */

/**
 * @typedef {Object} UploadSignatureResponse
 * @property {string} upload_url
 * @property {string} fields
 * @property {string} photo_url
 */

/**
 * @typedef {Object} ConfirmPhotoRequest
 * @property {string} ticket
 */

/**
 * @typedef {Object} ConfirmPhotoResponse
 * @property {string} photo_url
 * @property {number} photo_expires_in
 */

export const __types = null

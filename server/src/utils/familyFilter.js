// Appends an optional family_member_id filter to an assets query.
// Pass request.query.family_member_id:
//   undefined / not sent  → no filter (show all members)
//   'self'               → family_member_id IS NULL (owner's own assets)
//   '<number>'           → family_member_id = N
function familyFilter(request) {
  const fmId = request.query?.family_member_id
  if (fmId === undefined) return { sql: '', params: [] }
  if (fmId === 'self' || fmId === '' || fmId === 'null') {
    return { sql: ' AND a.family_member_id IS NULL', params: [] }
  }
  return { sql: ' AND a.family_member_id = ?', params: [parseInt(fmId)] }
}

module.exports = { familyFilter }

import { create } from 'zustand'

// activeMemberId semantics:
//   null → All members (no filter applied)
//   0    → Self / owner (family_member_id IS NULL in DB)
//   N    → Specific family member with id N
const useFilterStore = create((set) => ({
  activeMemberId: null,
  activeFY: '2024-25',

  setActiveMember: (id) => set({ activeMemberId: id }),
  setActiveFY: (fy) => set({ activeFY: fy }),
}))

export default useFilterStore

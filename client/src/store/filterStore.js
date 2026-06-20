import { create } from 'zustand'

const useFilterStore = create((set) => ({
  activeMemberId: null,   // null = owner (self)
  activeFY: '2024-25',   // current financial year

  setActiveMember: (id) => set({ activeMemberId: id }),
  setActiveFY: (fy) => set({ activeFY: fy }),
}))

export default useFilterStore

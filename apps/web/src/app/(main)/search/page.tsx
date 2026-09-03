'use client'

/**
 * app/(main)/search/page.tsx — หน้าค้นหา/browse แบบละเอียด
 *
 * แถบที่ 1: สลับค้นจาก "ชื่อเรื่อง" หรือ "นักเขียน" + ช่องค้นหา
 * แถบที่ 2: สถานะจบ / กรองจาก (sort) / ช่วงเวลา + ปุ่มสลับทิศทางเรียง
 * แถบที่ 3: หมวดหมู่หลัก/รอง (dropdown พิมพ์ค้นหาได้ เหมือนหน้า writer) + หมวดหมู่ย่อย (พิมพ์เพิ่มได้)
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Search as SearchIcon, X, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, List, SlidersHorizontal } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/writer/searchable-select'
import { TagAutocompleteInput } from '@/components/writer/tag-autocomplete-input'
import { SearchGalleryCard, SearchResultCard } from '@/components/search/search-result-card'
import { WriterResultCard, type WriterResultData } from '@/components/search/writer-result-card'
import { SearchResultCardSkeleton, WriterResultCardSkeleton } from '@/components/loading/public-page-skeletons'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CategoryRef, SearchResultData } from '@/types'

const RESULTS_PER_PAGE = 20
const SEARCH_DEBOUNCE_MS = 400

// 2026-07-30 มติแก้: ตัด 'latest' ออกจากตัวเลือกที่หน้านี้โชว์ (user ถามว่า "ลงเรื่องล่าสุด"
// ต่างจาก "อัปเดตล่าสุด" ตรงไหน แล้วขอรวมเหลือแค่ "อัปเดตล่าสุด" เดียว) — ฝั่ง backend ยัง
// มี sort='latest' อยู่เหมือนเดิม (จุดอื่นในระบบใช้อยู่ เช่น getAuthorWorks/getBookmarks
// default) แค่หน้านี้ไม่โชว์เป็นตัวเลือกแยกให้เลือกอีกต่อไป
type SortField = 'updated' | 'popular' | 'likes' | 'sales' | 'comments'
type SortDir = 'asc' | 'desc'
type CompletionFilter = '' | 'ongoing' | 'completed' | 'hiatus'
type DateRangeFilter = '' | 'today' | 'week' | 'month' | 'year'
// 'all' = ทั่วไปเท่านั้น (ตรงกับค่า age_rate='all' ฝั่ง backend, ชื่อซ้ำกับ 'both' ด้านล่างโดยตั้งใจ
// ให้ตรงกับ literal ที่ backend รับ), '18+' = 18+ เท่านั้น, 'both' = ไม่ส่ง age_rate เลย (backend
// ไม่ filter เลยถ้าไม่ส่ง param นี้มา — ดู getWorks() ใน works.service.ts) เป็นค่า default ใหม่
// (2026-08-17 — เดิม toggle บังคับเลือก 2 ทาง ไม่มี "ทั้งหมด" user บอกว่าเสียเวลาสลับไปมา)
type AgeRatingFilter = 'all' | '18+' | 'both'
type LengthFilter = 'serial' | 'one_shot'

const SORT_FIELDS: SortField[] = ['updated', 'popular', 'likes', 'sales', 'comments']
const DATE_RANGES: DateRangeFilter[] = ['today', 'week', 'month', 'year']

interface ApiCategory {
  id: string
  name: string
}

// รูปทรงตรงกับ GET /works จริง (works.service.ts) — เพิ่ม description/tags/updated_at
// ให้แล้วสำหรับหน้านี้โดยเฉพาะ (ดู KNOWN_ISSUES.md)
interface ApiSearchRow {
  uuid: string
  title: string
  description: string | null
  cover_image: string | null
  view_count: string | null
  tags: string[]
  like_count: number
  comment_count: number
  updated_at: string
  age_rate: 'all' | '18+' | null
  author: { display_name: string }
  category_main: { id: string; name: string } | null
  category_sub: { id: string; name: string } | null
}

interface ApiSearchResponse {
  data: ApiSearchRow[]
  pagination: { page: number; limit: number; total: number; total_pages: number }
}

// รูปทรงตรงกับ GET /users/search จริง (user.service.ts searchWriters) — 2026-07-30 โหมด
// "นักเขียน" ค้นหา "คนเขียน" จริงๆ แล้ว (เดิมยังคืนการ์ดนิยายที่กรองด้วยชื่อผู้แต่งอยู่)
interface ApiWriterResponse {
  data: WriterResultData[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

function mapRow(row: ApiSearchRow): SearchResultData {
  return {
    uuid: row.uuid,
    title: row.title,
    description: row.description,
    cover_image: row.cover_image,
    author_name: row.author.display_name,
    age_rate: row.age_rate ?? 'all',
    category_main: row.category_main ? { id: Number(row.category_main.id), name: row.category_main.name } : null,
    category_sub: row.category_sub ? { id: Number(row.category_sub.id), name: row.category_sub.name } : null,
    tags: row.tags,
    view_count: Number(row.view_count ?? 0),
    like_count: row.like_count,
    comment_count: row.comment_count,
    updated_at: row.updated_at,
  }
}

// อ่านค่าเริ่มต้นจาก URL query string (?sort=&date_range=) — ใช้ตอนกด "ทั้งหมด" จากหน้า
// Home/RankingBoard เข้ามา เพื่อพรีเซ็ตตัวกรองให้ตรงกับหัวข้อที่กดมา (อ่านครั้งเดียวตอน mount
// ผ่าน useState initializer — หลังจากนั้นผู้ใช้เปลี่ยน filter ในหน้านี้ได้ตามปกติ ไม่ sync กลับ URL)
function SearchPageContent() {
  const searchParams = useSearchParams()
  const urlSort = searchParams.get('sort')
  const urlDateRange = searchParams.get('date_range')
  // ตัวกรองที่มาจากลิงก์ภายนอก (เช่น การ์ดหมวดหมู่/แท็กหน้าแรก) — เดิมมีแค่ sort/date_range ที่อ่าน
  // จาก URL ตอน mount จริงๆ ส่วน category_main_id/category_sub_id/tags/age_rate ถูกเซ็ตเป็น query
  // param ตอนกด "ทั้งหมด"/คลิกการ์ดจากหน้าอื่นๆ อยู่แล้ว แต่หน้านี้ไม่เคยอ่านกลับมาเลย (ลิงก์ที่ส่ง
  // มาพร้อมตัวกรองพวกนี้เลยไม่มีผลอะไร) แก้ให้อ่านครบเหมือน sort/date_range
  const urlTags = searchParams.get('tags')
  const urlAgeRate = searchParams.get('age_rate')
  const urlCategoryMainId = searchParams.get('category_main_id')
  const urlCategorySubId = searchParams.get('category_sub_id')
  const hasUrlFilters = Boolean(urlTags || urlAgeRate || urlCategoryMainId || urlCategorySubId)

  const [searchField, setSearchField] = useState<'title' | 'author'>('title')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [completionStatus, setCompletionStatus] = useState<CompletionFilter>('')
  const [sortBy, setSortBy] = useState<SortField>(
    SORT_FIELDS.includes(urlSort as SortField) ? (urlSort as SortField) : 'updated',
  )
  const [dateRange, setDateRange] = useState<DateRangeFilter>(
    DATE_RANGES.includes(urlDateRange as DateRangeFilter) ? (urlDateRange as DateRangeFilter) : '',
  )
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [categoryMain, setCategoryMain] = useState<CategoryRef | null>(null)
  const [categorySub, setCategorySub] = useState<CategoryRef | null>(null)
  const [tags, setTags] = useState<string[]>(() => (urlTags ? urlTags.split(',').filter(Boolean) : []))
  // toggle บังคับเลือกฝั่งใดฝั่งหนึ่งเสมอ (เหมือนปุ่มเรียงทิศทางด้านบน ไม่มีค่า "ทั้งคู่"/"ทั้งหมด")
  // ตามที่ user ขอ 2026-07-30 — default ไปฝั่งที่ครอบคลุมเนื้อหาส่วนใหญ่ (ทั่วไป, เรื่องยาว)
  const [ageRating, setAgeRating] = useState<AgeRatingFilter>(
    urlAgeRate === '18+' ? '18+' : urlAgeRate === 'all' ? 'all' : 'both',
  )
  const [lengthFilter, setLengthFilter] = useState<LengthFilter>('serial')
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(hasUrlFilters)
  const [resultView, setResultView] = useState<'list' | 'gallery'>('list')
  const [page, setPage] = useState(1)

  // โหมด "นักเขียน" ค้นหา "คนเขียน" จริงๆ (2026-07-30 มติแก้ — เดิมยังคืนการ์ดนิยายที่กรอง
  // ด้วยชื่อผู้แต่งอยู่ ทั้งที่ user บอกว่าตัวกรองเรื่อง (หมวดหมู่/สถานะจบ/ฯลฯ) ไม่มีผลกับโหมดนี้
  // เลย เพราะเป็นคุณสมบัติของ "เรื่อง" ไม่ใช่ "คนเขียน") ใช้แยก endpoint/การ์ด/ตัวกรองที่ใช้งานได้
  const isAuthorMode = searchField === 'author'

  // ดีเลย์ก่อนยิง query ตอนพิมพ์ค้นหา — กันยิง request รัวทุกตัวอักษร
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  // เปลี่ยน filter ไหนก็ตาม → กลับไปหน้า 1 เสมอ (ผลลัพธ์ชุดใหม่ หน้าเดิมอาจไม่มีอยู่แล้ว)
  useEffect(() => {
    setPage(1)
  }, [searchField, debouncedSearch, completionStatus, sortBy, dateRange, sortDir, categoryMain, categorySub, tags, ageRating, lengthFilter])

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ data: ApiCategory[] }>('/categories').then((res) => res.data),
  })
  const categories: CategoryRef[] = (categoriesData ?? []).map((c) => ({ id: Number(c.id), name: c.name }))

  // ตั้ง categoryMain/categorySub จาก URL ได้ก็ต่อเมื่อ categories โหลดมาแล้ว (ต้องมี name ไม่ใช่แค่ id
  // เพราะ SearchableSelect ต้องการ CategoryRef เต็ม) ใช้ ref กันไม่ให้ทับค่าที่ผู้ใช้เปลี่ยนเองทีหลัง
  const appliedUrlCategoryRef = useRef(false)
  useEffect(() => {
    if (appliedUrlCategoryRef.current || categories.length === 0) return
    if (!urlCategoryMainId && !urlCategorySubId) return
    appliedUrlCategoryRef.current = true
    if (urlCategoryMainId) {
      const found = categories.find((c) => c.id === Number(urlCategoryMainId))
      if (found) setCategoryMain(found)
    }
    if (urlCategorySubId) {
      const found = categories.find((c) => c.id === Number(urlCategorySubId))
      if (found) setCategorySub(found)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length])

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(RESULTS_PER_PAGE))
  params.set('sort', sortBy)
  params.set('sort_dir', sortDir)
  if (debouncedSearch) {
    params.set('search', debouncedSearch)
    params.set('search_field', searchField)
  }
  if (completionStatus) params.set('completion_status', completionStatus)
  if (dateRange) params.set('date_range', dateRange)
  if (categoryMain) params.set('category_main_id', String(categoryMain.id))
  if (categorySub) params.set('category_sub_id', String(categorySub.id))
  if (tags.length > 0) params.set('tags', tags.join(','))
  if (ageRating !== 'both') params.set('age_rate', ageRating)
  params.set('is_one_shot', String(lengthFilter === 'one_shot'))
  const queryString = params.toString()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['works', 'search', queryString],
    queryFn: () => api.get<ApiSearchResponse>(`/works?${queryString}`),
    enabled: !isAuthorMode,
  })

  const results = (data?.data ?? []).map(mapRow)
  const totalPages = data?.pagination.total_pages ?? 1

  // โหมด "นักเขียน" — ตัวกรองอื่นทั้งหมด (หมวดหมู่/สถานะจบ/เรตอายุ/ฯลฯ) ไม่มีผล ส่งแค่
  // search + pagination เท่านั้น
  const {
    data: writerData,
    isLoading: writerLoading,
    isError: writerError,
  } = useQuery({
    queryKey: ['users', 'search', debouncedSearch, page],
    queryFn: () =>
      api.get<ApiWriterResponse>(`/users/search?page=${page}&limit=${RESULTS_PER_PAGE}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`),
    enabled: isAuthorMode,
  })

  const writers = writerData?.data ?? []
  const writerTotalPages = writerData?.pagination.pages ?? 1
  const currentTotalPages = isAuthorMode ? writerTotalPages : totalPages

  // กล่อง input/dropdown ทุกจุดในหน้านี้ — สีขาวจริง + ขอบเทาอ่อน #d9d9d9 + มุมโค้ง 10px
  // (ดึงค่าตรงจาก Figma node 78:197 "Search Menu" ผ่าน API — ไม่ใช่ bg-card/border-input
  // เดิมของ shadcn เพราะ --card กับ --background เป็นสีเดียวกันในธีมนี้ ทำให้กล่องหายไปเลย)
  const whiteBoxClass = 'border-[#d9d9d9] bg-white rounded-[10px]'
  const advancedFilterCount =
    Number(categoryMain !== null) +
    Number(categorySub !== null) +
    tags.length +
    Number(sortDir !== 'desc') +
    Number(ageRating !== 'both') +
    Number(lengthFilter !== 'serial')

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <h1 className="mb-4 text-[28px] font-bold tracking-tight text-black">ค้นหา</h1>

      {/* แถบที่ 1 — สลับ ชื่อเรื่อง/นักเขียน (sliding pill #d0c6b0/#471f21) + ช่องค้นหา */}
      <div className={cn('mb-4 flex h-11 items-center gap-2 border px-2 shadow-sm', whiteBoxClass)}>
        {/* pill ขนาดตายตัว 154x32 ตรงกับ Figma (node 78:197 "Group 79") — ก่อนหน้านี้เคยทำเป็น
            flex-[2] ยืดตามอัตราส่วน 1:1:2 กับช่องค้นหาไปแล้ว แต่ user แจ้งว่านั่นเป็นคำสั่งที่ผิด
            ให้กลับมาใช้ขนาดตายตัวตามดีไซน์จริงแทน (ดู KNOWN_ISSUES.md) */}
        <div className="relative flex h-9 w-[168px] shrink-0 items-center rounded-xl border border-[#d8cbb3] bg-[#e9deca] p-1 shadow-inner">
          <div
            className={cn(
              'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-primary shadow-[0_3px_8px_rgb(71_31_33_/_0.2)] transition-transform duration-200',
              searchField === 'author' && 'translate-x-full',
            )}
          />
          <button
            type="button"
            onClick={() => setSearchField('title')}
            className={cn(
              'relative z-10 flex-1 cursor-pointer rounded-lg text-center text-sm font-semibold transition-colors',
              searchField === 'title' ? 'text-white' : 'text-primary',
            )}
          >
            ชื่อเรื่อง
          </button>
          <button
            type="button"
            onClick={() => setSearchField('author')}
            className={cn(
              'relative z-10 flex-1 cursor-pointer rounded-lg text-center text-sm font-semibold transition-colors',
              searchField === 'author' ? 'text-white' : 'text-primary',
            )}
          >
            นักเขียน
          </button>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SearchIcon className="size-[18px] shrink-0 text-[#d9d9d9]" strokeWidth={2.5} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={searchField === 'title' ? 'กำลังหาอะไรก็ลองพิมพ์ดูสิ' : 'ลองพิมพ์ชื่อนักเขียนดูสิ'}
            className="min-w-0 flex-1 bg-transparent text-sm text-black outline-none placeholder:text-[#d9d9d9]"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="ล้างคำค้นหา"
              className="shrink-0 cursor-pointer text-[#d9d9d9] hover:text-foreground"
            >
              <X className="size-[18px]" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* แถบที่ 2 — สถานะจบ / กรองจาก / ช่วงเวลา + ทิศทางเรียง (sliding pill เหมือนแถบที่ 1) */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#dedbd3] bg-white/75 p-3 shadow-sm">
        <div className="min-w-36 flex-1">
          <label className="mb-1.5 block text-sm font-medium text-black">สถานะจบ</label>
          <Select
            value={completionStatus || 'all'}
            onValueChange={(v) => setCompletionStatus(v === 'all' ? '' : (v as CompletionFilter))}
            disabled={isAuthorMode}
          >
            <SelectTrigger className={cn('!h-10 w-full border', whiteBoxClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="ongoing">กำลังดำเนินเรื่อง</SelectItem>
              <SelectItem value="completed">จบแล้ว</SelectItem>
              <SelectItem value="hiatus">พักการเขียน</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-36 flex-1">
          <label className="mb-1.5 block text-sm font-medium text-black">กรองจาก</label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortField)} disabled={isAuthorMode}>
            <SelectTrigger className={cn('!h-10 w-full border', whiteBoxClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">อัปเดตล่าสุด</SelectItem>
              <SelectItem value="popular">ยอดวิวสูงสุด</SelectItem>
              <SelectItem value="likes">ยอดใจสูงสุด</SelectItem>
              <SelectItem value="sales">ยอดขายสูงสุด</SelectItem>
              <SelectItem value="comments">ยอดคอมเมนต์สูงสุด</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-36 flex-1">
          <label className="mb-1.5 block text-sm font-medium text-black">ช่วงเวลา</label>
          <Select value={dateRange || 'all'} onValueChange={(v) => setDateRange(v === 'all' ? '' : (v as DateRangeFilter))} disabled={isAuthorMode}>
            <SelectTrigger className={cn('!h-10 w-full border', whiteBoxClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ตลอดกาล</SelectItem>
              <SelectItem value="today">วันนี้</SelectItem>
              <SelectItem value="week">สัปดาห์นี้</SelectItem>
              <SelectItem value="month">เดือนนี้</SelectItem>
              <SelectItem value="year">ปีนี้</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          className={cn(
            'relative flex h-10 w-[289px] shrink-0 items-center rounded-xl border border-[#d8cbb3] bg-[#e9deca] p-1 shadow-inner',
            isAuthorMode && 'pointer-events-none opacity-40',
          )}
        >
          <div
            className={cn(
              'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-primary shadow-[0_3px_8px_rgb(71_31_33_/_0.2)] transition-transform duration-200',
              sortDir === 'asc' && 'translate-x-full',
            )}
          />
          <button
            type="button"
            onClick={() => setSortDir('desc')}
            className={cn(
              'relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-lg text-center text-sm font-semibold transition-colors',
              sortDir === 'desc' ? 'text-white' : 'text-primary',
            )}
          >
            มากไปน้อย
          </button>
          <button
            type="button"
            onClick={() => setSortDir('asc')}
            className={cn(
              'relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-lg text-center text-sm font-semibold transition-colors',
              sortDir === 'asc' ? 'text-white' : 'text-primary',
            )}
          >
            น้อยไปมาก
          </button>
        </div>
      </div>

      {/* แถบที่ 3 — หมวดหมู่หลัก/รอง (dropdown พิมพ์ค้นหาได้ ตามที่ user ขอเปลี่ยนจาก radio เดิม)
          + toggle เรตอายุ/ความยาว 2 อัน (2026-07-30 ย้ายหมวดหมู่ย่อยออกไปเป็นแถวแยก — ดูด้านล่าง —
          แล้วเอา 2 toggle นี้มาแทนที่ช่องว่าง สไตล์เดียวกับปุ่มเรียงทิศทางแถบที่ 2) */}
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setAdvancedFiltersOpen((open) => !open)}
          aria-expanded={advancedFiltersOpen}
          aria-controls="advanced-search-filters"
          disabled={isAuthorMode}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors',
            advancedFiltersOpen || advancedFilterCount > 0
              ? 'border-primary/20 bg-primary/10 text-primary'
              : 'border-[#dedbd3] bg-white text-muted-foreground hover:bg-accent hover:text-foreground',
            isAuthorMode && 'cursor-not-allowed opacity-45',
          )}
        >
          <SlidersHorizontal className="size-3.5" />
          ตัวกรองเพิ่มเติม
          {advancedFilterCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
              {advancedFilterCount}
            </span>
          )}
          <ChevronDown className={cn('size-3.5 transition-transform', advancedFiltersOpen && 'rotate-180')} />
        </button>
      </div>

      {advancedFiltersOpen && (
        <div id="advanced-search-filters" className="mb-5 rounded-xl border border-[#dedbd3] bg-white/75 p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">ตัวกรองเพิ่มเติม</p>
            <p className="text-xs text-muted-foreground">ระบุเงื่อนไขให้ตรงกับเรื่องที่ต้องการ</p>
          </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-black">หมวดหมู่หลัก</label>
          <SearchableSelect
            options={categories}
            value={categoryMain}
            onChange={setCategoryMain}
            triggerClassName={cn('h-10 border', whiteBoxClass)}
            disabled={isAuthorMode}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-black">หมวดหมู่รอง</label>
          <SearchableSelect
            options={categories}
            value={categorySub}
            onChange={setCategorySub}
            triggerClassName={cn('h-10 border', whiteBoxClass)}
            disabled={isAuthorMode}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-black">เรตอายุ</label>
          {/* 3 ตัวเลือก (2026-08-17 — เดิม toggle 2 ทาง บังคับเลือกเสมอ ไม่มี "ทั้งหมด" user บอกว่า
              เสียเวลาสลับไปมา) เรียง ทั่วไป/18+/ทั้งหมด ตามที่ user ระบุ — default เป็น "ทั้งหมด" */}
          <div
            className={cn(
              'relative flex h-10 w-full items-center rounded-xl border border-[#d8cbb3] bg-[#e9deca] p-1 shadow-inner',
              isAuthorMode && 'pointer-events-none opacity-40',
            )}
          >
            <div
              className="absolute inset-y-1 left-1 w-[calc(33.333%-0.25rem)] rounded-lg bg-primary shadow-[0_3px_8px_rgb(71_31_33_/_0.2)] transition-transform duration-200"
              style={{
                transform: `translateX(${['all', '18+', 'both'].indexOf(ageRating) * 100}%)`,
              }}
            />
            <button
              type="button"
              onClick={() => setAgeRating('all')}
              className={cn(
                'relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-lg text-center text-sm font-semibold transition-colors',
                ageRating === 'all' ? 'text-white' : 'text-primary',
              )}
            >
              ทั่วไป
            </button>
            <button
              type="button"
              onClick={() => setAgeRating('18+')}
              className={cn(
                'relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-lg text-center text-sm font-semibold transition-colors',
                ageRating === '18+' ? 'text-white' : 'text-primary',
              )}
            >
              18+
            </button>
            <button
              type="button"
              onClick={() => setAgeRating('both')}
              className={cn(
                'relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-lg text-center text-sm font-semibold transition-colors',
                ageRating === 'both' ? 'text-white' : 'text-primary',
              )}
            >
              ทั้งหมด
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-black">ความยาว</label>
          <div
            className={cn(
              'relative flex h-10 w-full items-center rounded-xl border border-[#d8cbb3] bg-[#e9deca] p-1 shadow-inner',
              isAuthorMode && 'pointer-events-none opacity-40',
            )}
          >
            <div
              className={cn(
                'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-primary shadow-[0_3px_8px_rgb(71_31_33_/_0.2)] transition-transform duration-200',
                lengthFilter === 'one_shot' && 'translate-x-full',
              )}
            />
            <button
              type="button"
              onClick={() => setLengthFilter('serial')}
              className={cn(
                'relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-lg text-center text-sm font-semibold transition-colors',
                lengthFilter === 'serial' ? 'text-white' : 'text-primary',
              )}
            >
              เรื่องยาว
            </button>
            <button
              type="button"
              onClick={() => setLengthFilter('one_shot')}
              className={cn(
                'relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-lg text-center text-sm font-semibold transition-colors',
                lengthFilter === 'one_shot' ? 'text-white' : 'text-primary',
              )}
            >
              One shot
            </button>
          </div>
        </div>
      </div>

      {/* แถบที่ 4 (ใหม่ 2026-07-30) — หมวดหมู่ย่อย ย้ายมาอยู่แถวเดียวเต็มความกว้าง (เดิมอยู่แถบที่ 3
          ช่องที่ 3 ก่อนย้ายที่ให้ toggle เรตอายุ/ความยาวด้านบน) */}
      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium text-black">หมวดหมู่ย่อย</label>
        <TagAutocompleteInput
          tags={tags}
          onChange={setTags}
          triggerClassName={cn('min-h-10 w-full border', whiteBoxClass)}
          disabled={isAuthorMode}
        />
          </div>
        </div>
      )}

      {!isAuthorMode && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">ผลลัพธ์นิยาย</p>
          <div
            role="group"
            aria-label="เลือกรูปแบบการแสดงผล"
            className="flex items-center rounded-xl border border-[#dedbd3] bg-white p-1 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setResultView('list')}
              aria-label="แสดงผลแบบรายการ"
              title="มุมมองรายการ"
              className={cn(
                'flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors',
                resultView === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setResultView('gallery')}
              aria-label="แสดงผลแบบแกลเลอรี"
              title="มุมมองแกลเลอรี"
              className={cn(
                'flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors',
                resultView === 'gallery' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ผลลัพธ์ — โหมด "นักเขียน" การ์ดแนวนอนยาวคนละแบบกับการ์ดนิยาย (2026-07-30) */}
      {isAuthorMode ? (
        writerLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, index) => (
              <WriterResultCardSkeleton key={index} />
            ))}
          </div>
        ) : writerError ? (
          <p className="py-16 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
        ) : writers.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">ไม่พบนักเขียนที่ตรงกับเงื่อนไข</p>
        ) : (
          <div className="flex flex-col gap-4">
            {writers.map((writer) => (
              <WriterResultCard key={writer.uuid} writer={writer} />
            ))}
          </div>
        )
      ) : isLoading ? (
        <div className={cn(
          'grid gap-x-5 gap-y-6',
          resultView === 'gallery' ? 'grid-cols-[repeat(auto-fill,minmax(154px,1fr))]' : 'grid-cols-1 lg:grid-cols-2',
        )}>
          {Array.from({ length: 6 }, (_, index) => (
            <SearchResultCardSkeleton key={index} />
          ))}
        </div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
      ) : results.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">ไม่พบผลงานที่ตรงกับเงื่อนไข</p>
      ) : (
        <div className={cn(
          'grid gap-x-5 gap-y-6',
          resultView === 'gallery' ? 'grid-cols-[repeat(auto-fill,minmax(154px,1fr))]' : 'grid-cols-1 lg:grid-cols-2',
        )}>
          {results.map((novel) =>
            resultView === 'gallery' ? (
              <SearchGalleryCard key={novel.uuid} novel={novel} />
            ) : (
              <SearchResultCard key={novel.uuid} novel={novel} />
            ),
          )}
        </div>
      )}

      {/* Pagination */}
      {currentTotalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="หน้าก่อนหน้า"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {currentTotalPages}
          </span>
          <button
            type="button"
            disabled={page >= currentTotalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="หน้าถัดไป"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1280px] px-8 py-16 text-center text-sm text-muted-foreground">
          กำลังเตรียมหน้าค้นหา...
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  )
}

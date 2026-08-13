export type Role = 'seller' | 'customer'

export interface Profile {
  id: string
  name: string
  avatar: string | null
  role: Role
  created_at: string
}

export type LiveStatus = 'scheduled' | 'live' | 'ended'

export interface Product {
  id: string
  seller_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  stock: number
  status: string
  created_at: string
}

export interface LiveSession {
  id: string
  host_id: string
  product_id: string
  status: LiveStatus
  created_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  user_id: string
  message: string
  created_at: string
}

export interface CartItem {
  id: string
  customer_id: string
  product_id: string
  quantity: number
  created_at: string
}

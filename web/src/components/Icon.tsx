// Maps the mobile app's IconName union onto lucide-react icons, so screens can
// be ported with the same icon names they used in React Native.
import {
  ArrowLeft, ChevronRight, ChevronDown, User, Mail, Phone, Eye, EyeOff, MapPin,
  Home, HelpCircle, BookOpen, Calendar, Clock, MessageCircle, MessageSquare,
  Repeat, Heart, FileText, Video, Mic, Play, Pause, Plus, X, Send, Bell, Pencil,
  Trash2, LogOut, Camera, Maximize, Check, CheckCircle2, Bookmark, Image as ImageIcon,
  Volume2, Compass, Download, Upload, Loader2, type LucideIcon,
} from 'lucide-react';

export type IconName =
  | 'arrow-left' | 'chevron-right' | 'chevron-down' | 'user' | 'mail' | 'phone'
  | 'eye' | 'eye-off' | 'map-pin' | 'home' | 'help-circle' | 'book-open'
  | 'calendar' | 'clock' | 'message-circle' | 'message-square' | 'repeat'
  | 'heart' | 'file-text' | 'video' | 'mic' | 'play' | 'pause' | 'plus' | 'x'
  | 'send' | 'bell' | 'edit' | 'trash' | 'log-out' | 'camera' | 'maximize'
  | 'check' | 'check-circle' | 'bookmark' | 'image' | 'volume' | 'compass' | 'download'
  | 'upload' | 'loader';

const MAP: Record<IconName, LucideIcon> = {
  'arrow-left': ArrowLeft, 'chevron-right': ChevronRight, 'chevron-down': ChevronDown,
  user: User, mail: Mail, phone: Phone, eye: Eye, 'eye-off': EyeOff, 'map-pin': MapPin,
  home: Home, 'help-circle': HelpCircle, 'book-open': BookOpen, calendar: Calendar,
  clock: Clock, 'message-circle': MessageCircle, 'message-square': MessageSquare,
  repeat: Repeat, heart: Heart, 'file-text': FileText, video: Video, mic: Mic,
  play: Play, pause: Pause, plus: Plus, x: X, send: Send, bell: Bell, edit: Pencil,
  trash: Trash2, 'log-out': LogOut, camera: Camera, maximize: Maximize, check: Check,
  'check-circle': CheckCircle2, bookmark: Bookmark, image: ImageIcon, volume: Volume2,
  compass: Compass, download: Download, upload: Upload, loader: Loader2,
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color = '#1A3A38', fill = 'none', strokeWidth = 2 }: IconProps) {
  const Cmp = MAP[name];
  return <Cmp size={size} color={color} fill={fill} strokeWidth={strokeWidth} />;
}

export function GoogleIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

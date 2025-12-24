"use client";
import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Search, X, Clock, Smile, Cat, UtensilsCrossed, Plane, Trophy, Lightbulb, Sparkles, Flag } from 'lucide-react';
import { useWalletNicknameStore } from '@/store/useWalletNicknameStore';

interface EmojiPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentEmoji: string;
}

type CategoryKey = 'Smileys & People' | 'Animals & Nature' | 'Food & Drink' | 'Travel & Places' | 'Activities' | 'Objects' | 'Symbols' | 'Flags';

const EMOJI_CATEGORIES: Record<CategoryKey, string[]> = {
  'Smileys & People': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '🫠', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴'],
  'Animals & Nature': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀'],
  'Food & Drink': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯'],
  'Travel & Places': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩', '💺', '🛰', '🚀', '🛸'],
  'Activities': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🤼‍♀️', '🤼', '🤸‍♀️', '🤸', '⛹️‍♀️', '⛹️', '🤺', '🤾‍♀️', '🤾', '🏌️‍♀️', '🏌️', '🏇'],
  'Objects': ['⌚', '📱', '📲', '💻', '⌨', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵', '💴', '💶'],
  'Symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️'],
  'Flags': ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇺🇳', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻'],
};

const CATEGORY_ICONS: Record<CategoryKey, React.ElementType> = {
  'Smileys & People': Smile,
  'Animals & Nature': Cat,
  'Food & Drink': UtensilsCrossed,
  'Travel & Places': Plane,
  'Activities': Trophy,
  'Objects': Lightbulb,
  'Symbols': Sparkles,
  'Flags': Flag,
};

export function EmojiPickerModal({ isOpen, onClose, onSelect, currentEmoji }: EmojiPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('Smileys & People');
  
  const getFrequentlyUsedEmojis = useWalletNicknameStore((state) => state.getFrequentlyUsedEmojis);
  const frequentEmojis = useMemo(() => getFrequentlyUsedEmojis(), [getFrequentlyUsedEmojis]);

  const handleEmojiSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
    setSearchQuery('');
  };

  const filteredEmojis = useMemo(() => {
    if (searchQuery) {
      return Object.values(EMOJI_CATEGORIES).flat();
    }
    return EMOJI_CATEGORIES[selectedCategory];
  }, [searchQuery, selectedCategory]);

  const showFrequentlyUsed = !searchQuery && frequentEmojis.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="bg-bgPrimary border border-borderDefault rounded-xl p-0 
                   w-[95vw] sm:w-[400px] md:w-[420px]
                   h-[75vh] sm:h-[550px] md:h-[580px]
                   shadow-xl overflow-hidden"
      >
        <VisuallyHidden>
          <DialogTitle>Emoji Picker</DialogTitle>
        </VisuallyHidden>

        <div className="flex flex-col h-full">
          {/* Simple Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-borderDefault flex-shrink-0">
            <h3 className="text-sm font-medium text-textPrimary">Select Emoji</h3>
            <button
              onClick={onClose}
              className="text-grayGhost hover:text-textPrimary transition-colors p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-4 py-3 border-b border-borderDefault flex-shrink-0">
            <div className="relative">
              <Search 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-grayGhost pointer-events-none" 
                size={16} 
              />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm bg-bgSecondary border border-borderDefault rounded-md 
                         text-textPrimary placeholder:text-grayGhost
                         focus:outline-none focus:border-success
                         transition-all"
              />
            </div>
          </div>

          {/* Icon-Based Category Navigation */}
          <div className="flex items-center justify-around px-2 py-2.5 border-b border-borderDefault flex-shrink-0">
            {(Object.keys(EMOJI_CATEGORIES) as CategoryKey[]).map((category) => {
              const Icon = CATEGORY_ICONS[category];
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`p-2 rounded-lg transition-all ${
                    selectedCategory === category
                      ? 'bg-success/20 text-success'
                      : 'text-grayGhost hover:text-textPrimary hover:bg-bgSecondary/50'
                  }`}
                  title={category}
                >
                  <Icon size={20} strokeWidth={2} />
                </button>
              );
            })}
          </div>

          {/* Emoji Grid with Smooth Scrolling */}
          <div className="flex-1 overflow-y-auto scroll-smooth scrollbar-thin scrollbar-thumb-borderDefault/50 scrollbar-track-transparent hover:scrollbar-thumb-borderDefault min-h-0">
            <div className="px-4 py-3">
              {/* Frequently Used */}
              {showFrequentlyUsed && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-grayGhost mb-2.5">
                    Frequently Used
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-9 gap-1 mb-3">
                    {frequentEmojis.map((emoji, index) => (
                      <button
                        key={`freq-${index}`}
                        onClick={() => handleEmojiSelect(emoji)}
                        className={`aspect-square flex items-center justify-center text-2xl sm:text-3xl rounded-lg 
                                  hover:bg-bgSecondary transition-all active:scale-95
                                  ${emoji === currentEmoji ? 'bg-success/20 ring-2 ring-success' : ''}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Category */}
              <div>
                <div className="text-xs font-semibold text-grayGhost mb-2.5">
                  {searchQuery ? 'Search Results' : selectedCategory}
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-9 gap-1 pb-4">
                  {filteredEmojis.map((emoji, index) => (
                    <button
                      key={`emoji-${index}`}
                      onClick={() => handleEmojiSelect(emoji)}
                      className={`aspect-square flex items-center justify-center text-2xl sm:text-3xl rounded-lg 
                                hover:bg-bgSecondary transition-all active:scale-95
                                ${emoji === currentEmoji ? 'bg-success/20 ring-2 ring-success' : ''}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Empty State */}
                {searchQuery && filteredEmojis.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search size={40} className="text-grayGhost/40 mb-3" />
                    <p className="text-sm text-grayGhost">No emojis found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* What's Your Mood - Bottom Section */}
          <div className="flex items-center justify-center gap-2.5 px-4 py-3 border-t border-borderDefault bg-bgSecondary/20 flex-shrink-0">
            <span className="text-2xl">😀</span>
            <span className="text-sm font-medium text-grayGhost">What&apos;s Your Mood?</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


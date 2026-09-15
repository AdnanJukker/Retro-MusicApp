import { useState, type ComponentProps, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { useArtworkMotion } from '@/hooks/useArtworkMotion';
import { usePlayerStore, type RepeatMode } from '@/store/playerStore';

type Icon = ComponentProps<typeof Feather>['name'];
type Dialog = 'history' | 'favorites' | 'preferences' | 'about' | 'quality' | null;
const REPEAT_OPTIONS: { value: RepeatMode; label: string }[] = [
  { value: 'off', label: 'Off' }, { value: 'all', label: 'Queue' }, { value: 'one', label: 'One song' },
];

function SettingsGroup({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <View style={styles.group}>
    <Text accessibilityRole="header" style={[Type.labelCaps, styles.groupTitle]}>{title}</Text>
    <View style={styles.groupCard}>{children}</View>
    {note ? <Text style={[Type.bodySm, styles.groupNote]}>{note}</Text> : null}
  </View>;
}

function SettingsRow({ icon, label, description, value, onPress, checked, onChange, disabled, last, destructive }: {
  icon: Icon; label: string; description?: string; value?: string;
  onPress?: () => void; checked?: boolean; onChange?: (value: boolean) => void;
  disabled?: boolean; last?: boolean; destructive?: boolean;
}) {
  const content = <>
    <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
      <Feather name={icon} size={18} color={destructive ? Colors.accent : Colors.ink} />
    </View>
    <View style={styles.rowCopy}>
      <Text style={[Type.bodyMdSemiBold, destructive && styles.destructiveText]}>{label}</Text>
      {description ? <Text style={[Type.bodySm, styles.muted]}>{description}</Text> : null}
    </View>
    {onChange ? <Switch accessibilityLabel={label} accessibilityHint={description}
      value={checked} onValueChange={onChange} trackColor={{ false: Colors.well, true: Colors.accent }}
      thumbColor={Colors.surfaceRaised} ios_backgroundColor={Colors.well}
    /> : <View style={styles.rowRight}>
      {value ? <Text style={[Type.bodySm, styles.muted]}>{value}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={16} color={Colors.textSecondary} /> : null}
    </View>}
  </>;
  const rowStyle = [styles.row, last && styles.lastRow, disabled && styles.disabled];
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={description} accessibilityState={{ disabled: Boolean(disabled) }}
    onPress={onPress} disabled={disabled} style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}>
    {content}
  </Pressable> : <View style={rowStyle}>{content}</View>;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const motionEnabled = useArtworkMotion();
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const continueQueue = usePlayerStore((s) => s.continueQueue);
  const saveHistory = usePlayerStore((s) => s.saveHistory);
  const animateArtwork = usePlayerStore((s) => s.animateArtwork);
  const compactRows = usePlayerStore((s) => s.compactRows);
  const favoritesCount = usePlayerStore((s) => s.favorites.length);
  const historyCount = usePlayerStore((s) => s.history.length);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const setRepeat = usePlayerStore((s) => s.setRepeat);
  const setContinueQueue = usePlayerStore((s) => s.setContinueQueue);
  const setSaveHistory = usePlayerStore((s) => s.setSaveHistory);
  const setAnimateArtwork = usePlayerStore((s) => s.setAnimateArtwork);
  const setCompactRows = usePlayerStore((s) => s.setCompactRows);
  const clearHistory = usePlayerStore((s) => s.clearHistory);
  const clearFavorites = usePlayerStore((s) => s.clearFavorites);
  const resetPreferences = usePlayerStore((s) => s.resetPreferences);
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const close = () => setDialog(null);
  const open = (value: Dialog) => { setNotice(null); setDialog(value); };
  const songCount = (count: number) => `${count} ${count === 1 ? 'song' : 'songs'}`;
  const dialogs = {
    history: { icon: 'clock', title: 'Clear recent plays?', text: `Remove ${songCount(historyCount)} from your listening history on this device. Your liked songs will stay saved.`, action: 'Clear recent plays' },
    favorites: { icon: 'heart', title: 'Clear liked songs?', text: `Remove all ${songCount(favoritesCount)} from your likes on this device. This cannot be undone.`, action: 'Clear liked songs' },
    preferences: { icon: 'sliders', title: 'Reset preferences?', text: 'Restore the default playback and appearance options. Your liked songs and listening history will stay saved.', action: 'Reset preferences' },
    about: { icon: 'disc', title: 'RetroWave', text: `A little space for a good record. Search music, build your library, and settle into listening.\n\nNew searches use the JioSaavn catalog. Your likes and preferences stay on this device.\n\nVersion ${version}`, action: null },
    quality: { icon: 'headphones', title: 'Streaming quality', text: 'Audio quality is chosen by the music source. There is no manual bitrate setting.\n\nAn internet connection is needed to listen. Songs are streamed as you play; liking a song saves it to your library, not for offline playback.', action: null },
  } as const;
  const activeDialog = dialog ? dialogs[dialog] : null;
  const confirm = () => {
    if (dialog === 'history') { clearHistory(); setNotice('Recent plays cleared.'); }
    if (dialog === 'favorites') { clearFavorites(); setNotice('Liked songs cleared.'); }
    if (dialog === 'preferences') { resetPreferences(); setNotice('Default preferences restored.'); }
    close();
  };

  return <View style={styles.flex}>
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <Feather name="arrow-left" size={20} color={Colors.ink} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={[Type.techSm, styles.muted]}>Your listening room</Text>
        <Text accessibilityRole="header" style={Type.headlineLg}>Settings</Text>
      </View>
      <View style={styles.headerMark}><Feather name="sliders" size={20} color={Colors.accent} /></View>
    </View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <View style={styles.introTop}>
          <View style={styles.introIcon}><Feather name="headphones" size={25} color={Colors.goldSoft} /></View>
          <View style={styles.introCopy}>
            <Text style={[Type.headlineLg, styles.lightText]}>Make it yours.</Text>
            <Text style={[Type.bodySm, styles.introDescription]}>Small adjustments. Better listening.</Text>
          </View>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={[Type.techLg, styles.lightText]}>{favoritesCount}</Text><Text style={[Type.bodySm, styles.introDescription]}>liked songs</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.stat}><Text style={[Type.techLg, styles.lightText]}>{historyCount}</Text><Text style={[Type.bodySm, styles.introDescription]}>recent plays</Text></View>
          <Feather name="disc" size={34} color={Colors.goldSoft} />
        </View>
      </View>
      {notice ? <View style={styles.notice} accessibilityLiveRegion="polite"><Feather name="check-circle" size={17} color={Colors.olive} /><Text style={[Type.bodySm, styles.noticeText]}>{notice}</Text></View> : null}
      <SettingsGroup title="Playback">
        <SettingsRow icon="list" label="Continue queue" description="Play the next song automatically." checked={continueQueue} onChange={setContinueQueue} />
        <SettingsRow icon="shuffle" label="Shuffle" description="Mix up the order of your queue." checked={shuffle} onChange={toggleShuffle} />
        <View style={styles.repeatBlock}>
          <SettingsRow icon="repeat" label="Repeat" description="Choose what stays on rotation." last />
          <View accessibilityRole="radiogroup" accessibilityLabel="Repeat mode" style={styles.segments}>
            {REPEAT_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="radio"
              accessibilityLabel={`Repeat ${option.label.toLowerCase()}`} accessibilityState={{ checked: repeat === option.value }}
              onPress={() => setRepeat(option.value)} style={[styles.segment, repeat === option.value && styles.segmentSelected]}>
              <Text style={[Type.bodySm, repeat === option.value ? styles.segmentTextSelected : styles.muted]}>{option.label}</Text>
              {repeat === option.value ? <Feather name="check" size={13} color={Colors.background} /> : null}
            </Pressable>)}
          </View>
        </View>
        <SettingsRow icon="headphones" label="Streaming quality" value="Automatic" onPress={() => open('quality')} last />
      </SettingsGroup>
      <SettingsGroup title="Look & feel" note="Artwork motion also follows your device’s Reduce Motion setting.">
        <SettingsRow icon="disc" label="Animate artwork" description="Spinning records and moving equalizers." checked={animateArtwork} onChange={setAnimateArtwork} />
        <SettingsRow icon="align-justify" label="Compact song rows" description="Fit more music on the screen." checked={compactRows} onChange={setCompactRows} last />
      </SettingsGroup>
      <SettingsGroup title="Your library" note="Your library is saved on this device. Liked songs are not offline downloads.">
        <SettingsRow icon="clock" label="Remember recent plays" description="Keep a history of the songs you listen to." checked={saveHistory} onChange={setSaveHistory} />
        <SettingsRow icon="delete" label="Clear recent plays" value={songCount(historyCount)} disabled={historyCount === 0} onPress={() => open('history')} />
        <SettingsRow icon="heart" label="Clear liked songs" value={songCount(favoritesCount)} disabled={favoritesCount === 0} onPress={() => open('favorites')} destructive last />
      </SettingsGroup>
      <SettingsGroup title="About the app">
        <SettingsRow icon="info" label="About RetroWave" value={`v${version}`} onPress={() => open('about')} />
        <SettingsRow icon="rotate-ccw" label="Reset preferences" description="Return to the original settings." onPress={() => open('preferences')} last />
      </SettingsGroup>
      <View style={styles.footer}><View style={styles.footerLine} /><Text style={[Type.techSm, styles.muted]}>RetroWave · Vol. 01</Text><View style={styles.footerLine} /></View>
    </ScrollView>
    <Modal visible={Boolean(activeDialog)} transparent animationType={motionEnabled ? 'fade' : 'none'} onRequestClose={close}>
      <View style={styles.modalWrap}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={close} style={styles.scrim} />
        {activeDialog ? <ScrollView accessibilityViewIsModal style={styles.dialog} contentContainerStyle={[styles.dialogContent, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
          <View style={styles.dialogTop}><View style={styles.dialogIcon}><Feather name={activeDialog.icon} size={22} color={Colors.accent} /></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={close} style={styles.backButton}><Feather name="x" size={20} color={Colors.ink} /></Pressable>
          </View>
          <Text accessibilityRole="header" style={Type.headlineLg}>{activeDialog.title}</Text>
          <Text style={[Type.bodyMd, styles.dialogDescription]}>{activeDialog.text}</Text>
          <View style={styles.dialogActions}>
            {activeDialog.action ? <Pressable accessibilityRole="button" onPress={close} style={[styles.dialogButton, styles.cancelButton]}><Text style={Type.bodyMdSemiBold}>Cancel</Text></Pressable> : null}
            <Pressable accessibilityRole="button" onPress={activeDialog.action ? confirm : close} style={[styles.dialogButton, styles.confirmButton]}>
              <Text style={[Type.bodyMdSemiBold, styles.lightText]}>{activeDialog.action ?? 'Got it'}</Text>
            </Pressable>
          </View>
        </ScrollView> : null}
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.hairline },
  headerCopy: { flex: 1, gap: 3 },
  headerMark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full, backgroundColor: Colors.surface },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  intro: { backgroundColor: Colors.ink, borderRadius: 16, padding: Spacing.xl, marginBottom: Spacing.xxl, gap: Spacing.xl },
  introTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  introIcon: { width: 52, height: 52, borderRadius: Radius.full, backgroundColor: '#383028', alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1, gap: Spacing.xs },
  lightText: { color: Colors.surfaceRaised },
  introDescription: { color: Colors.goldSoft },
  stats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(243,233,210,0.18)', paddingTop: Spacing.lg },
  stat: { flex: 1, gap: Spacing.xs },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(243,233,210,0.18)' },
  group: { marginBottom: Spacing.xxl },
  groupTitle: { color: Colors.textSecondary, marginBottom: Spacing.sm, paddingLeft: Spacing.xs },
  groupCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.hairline, overflow: 'hidden', backgroundColor: Colors.surfaceRaised },
  groupNote: { color: Colors.textSecondary, marginTop: Spacing.sm, paddingHorizontal: Spacing.xs },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.hairline },
  lastRow: { borderBottomWidth: 0 },
  rowIcon: { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  rowIconDestructive: { backgroundColor: Colors.accentSoft },
  rowCopy: { flex: 1, gap: 3 },
  rowRight: { maxWidth: '36%', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 1 },
  muted: { color: Colors.textSecondary, flexShrink: 1 },
  destructiveText: { color: Colors.accent },
  pressed: { backgroundColor: Colors.overlayInk },
  disabled: { opacity: 0.5 },
  repeatBlock: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.hairline, paddingBottom: Spacing.md },
  segments: { flexDirection: 'row', backgroundColor: Colors.background, marginHorizontal: Spacing.md, borderRadius: Radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, paddingHorizontal: Spacing.xs, flexDirection: 'row', gap: Spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  segmentSelected: { backgroundColor: Colors.ink },
  segmentTextSelected: { color: Colors.background },
  notice: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', backgroundColor: Colors.oliveSoft, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.xl },
  noticeText: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  footerLine: { height: StyleSheet.hairlineWidth, flex: 1, backgroundColor: Colors.hairline },
  modalWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingTop: 48 },
  scrim: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(24,20,16,0.55)' },
  dialog: { width: '100%', maxWidth: 520, maxHeight: '100%', flexGrow: 0, backgroundColor: Colors.surfaceRaised, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  dialogContent: { padding: Spacing.xl },
  dialogTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  dialogIcon: { width: 48, height: 48, backgroundColor: Colors.accentSoft, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  dialogDescription: { color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xxl },
  dialogActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dialogButton: { minHeight: 48, flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md },
  cancelButton: { borderWidth: 1, borderColor: Colors.hairline },
  confirmButton: { backgroundColor: Colors.accent },
});

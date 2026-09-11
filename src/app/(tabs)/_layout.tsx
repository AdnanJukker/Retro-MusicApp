import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/MiniPlayer';
import { Colors, Spacing, TabBarHeight, Type } from '@/constants/theme';

type TabDef = {
  name: string;
  href: '/' | '/search' | '/library';
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

const TABS: TabDef[] = [
  { name: 'index', href: '/', label: 'Home', icon: 'disc' },
  { name: 'search', href: '/search', label: 'Search', icon: 'search' },
  { name: 'library', href: '/library', label: 'Library', icon: 'archive' },
];

export default function TabsLayout() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <Tabs style={styles.flex}>
      <TabSlot style={styles.flex} />
      <MiniPlayer />
      <TabList style={[styles.tabList, { height: TabBarHeight + insets.bottom, paddingBottom: insets.bottom }]}>
        {TABS.map((tab) => {
          const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          const color = isActive ? Colors.accent : Colors.textSecondary;
          return (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: isActive }} style={styles.tabTrigger}>
              <View style={[styles.tabInner, isActive && styles.tabInnerActive]}>
                <Feather name={tab.icon} size={19} color={color} />
                <Text style={[Type.techSm, styles.tabLabel, { color }]}>{tab.label}</Text>
              </View>
            </TabTrigger>
          );
        })}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabList: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineStrong,
  },
  tabTrigger: {
    flex: 1,
  },
  tabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: Spacing.sm,
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  tabInnerActive: {
    borderTopColor: Colors.accent,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
});

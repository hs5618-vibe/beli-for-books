import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BookCover } from './BookCover';
import type { Recommendation } from '../services/recommendations';

type RecommendationModalProps = {
  visible: boolean;
  recommendations: Recommendation[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onPressSave: (recommendation: Recommendation) => Promise<void> | void;
  onPressViewDetails: (recommendation: Recommendation) => void;
};

export function RecommendationModal({
  visible,
  recommendations,
  isLoading = false,
  errorMessage,
  onClose,
  onPressSave,
  onPressViewDetails,
}: RecommendationModalProps) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Recommended for you</Text>
          <Text style={styles.subtitle}>Based on people with similar taste</Text>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator
                size="small"
                color="#111827"
              />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {recommendations.map((recommendation) => (
                <View
                  key={recommendation.id}
                  style={styles.card}
                >
                  <BookCover
                    uri={recommendation.coverUrl}
                    width={44}
                    height={66}
                  />
                  <View style={styles.cardBody}>
                    <Text style={styles.bookTitle}>{recommendation.title}</Text>
                    <Text style={styles.bookAuthor}>{recommendation.author}</Text>
                    <Text style={styles.reason}>{recommendation.reason}</Text>
                    <View style={styles.actionsRow}>
                      <Pressable
                        onPress={() => onPressSave(recommendation)}
                        style={[styles.actionButton, styles.saveButton]}
                      >
                        <Text style={styles.actionLabel}>Save</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onPressViewDetails(recommendation)}
                        style={[styles.actionButton, styles.viewButton]}
                      >
                        <Text style={[styles.actionLabel, styles.viewLabel]}>View details</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}

              {!recommendations.length && !errorMessage ? (
                <Text style={styles.emptyText}>No recommendations yet.</Text>
              ) : null}
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </ScrollView>
          )}

          <Pressable
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '80%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 13,
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  list: {
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  cardBody: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  bookAuthor: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
  },
  reason: {
    marginTop: 6,
    color: '#374151',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  saveButton: {
    backgroundColor: '#111827',
  },
  viewButton: {
    backgroundColor: '#E5E7EB',
  },
  actionLabel: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '700',
  },
  viewLabel: {
    color: '#374151',
  },
  closeButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeLabel: {
    color: '#374151',
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 10,
  },
  errorText: {
    textAlign: 'center',
    color: '#B91C1C',
    marginTop: 6,
    marginBottom: 10,
  },
});
